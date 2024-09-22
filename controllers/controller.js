import { mySqlPool as db } from "../config/database.js";
import ErrorHandler from "../middlewares/ErrorHandler.js";
import catchAsyncError from "../middlewares/catchAsyncError.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import {
  encryptPassword,
  isPasswordExist,
} from "../middlewares/encryptionMiddleware.js";

//---------------------------------------------------Register User----------------------------------------------------------------\\

export const register = catchAsyncError(async (req, res, next) => {
  const { name, number, email, password } = req.body;
  if (!name || !number || !password) {
    return next(new ErrorHandler("Please enter all required field", 400));
  }

  const isNumberExists = await db.query(
    "SELECT * FROM users WHERE number = ?",
    [number]
  );

  // Check is number already exists in db or not
  if (isNumberExists.length == 0) {
    return next(
      new ErrorHandler(
        "Number already exists. Please enter a valid number",
        403
      )
    );
  }

  // Query the database to fetch all hashed passwords
  const hashedPasswordData = await db.query("SELECT password FROM users");

  // Checking for duplicate password
  const hasDuplicatePassword = await isPasswordExist(
    hashedPasswordData,
    password
  );

  if (hasDuplicatePassword) {
    return next(new ErrorHandler("Password already exists", 403));
  }

  // Encrypt password
  const hashPassword = await encryptPassword(password);

  // check is mail  is valid or not
  if (email) {
    const isValid = validator.isEmail(email);
    if (!isValid) {
      return next(new ErrorHandler("Please enter a valid email", 403));
    }
  }

  const user = await db.query(
    "INSERT INTO users (name , number, email, password) VALUES(?,?,?,?)",
    [name, number, email, hashPassword]
  );

  await db.query("INSERT INTO global_db (name , number,isSpam) VALUES(?,?,?)", [
    name,
    number,
    0,
  ]);

  if (!user) {
    return next(
      new ErrorHandler("Error in creating user. Please try again!", 400)
    );
  }

  res.status(200).json({
    succuss: true,
    message: "New user has been created successfully",
    user: user[0],
  });
});

//-----------------------------------------------------------END-----------------------------------------------------------------------\\

//--------------------------------------------------------Login User--------------------------------------------------------------------\\

export const login = catchAsyncError(async (req, res, next) => {
  const { number, email, password } = req.body;

  // checking is all required field are provided or not
  if (!password || (!number && !email)) {
    return next(new ErrorHandler("Please fill all the required fields", 403));
  }
  const user = await db.query("SELECT * FROM users WHERE number = ?", [number]);

  if (!user) {
    return next(
      new ErrorHandler("User not found.Please enter valid crediantials", 404)
    );
  }

  // checking is entered password is correct or not
  const isPassword = bcrypt.compareSync(password, user[0][0].password);
  if (!isPassword) {
    return next(
      new ErrorHandler("User not found.Please enter valid crediantials", 404)
    );
  }

  // Generating token
  const token = jwt.sign(
    { id: user.id, number: user.number },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  res.status(200).cookie("token", token).cookie("userId", user[0][0].id).json({
    succuss: true,
    message: "Logged in successfully",
    token,
    user: user[0],
  });
});

//-----------------------------------------------------------END-----------------------------------------------------------------------\\

//--------------------------------------------------------Report Spam-------------------------------------------------------------------\\

export const reportSpam = catchAsyncError(async (req, res, next) => {
  const { number } = req.body;

  if (!number) {
    return next(new ErrorHandler("Please provide the required fields", 403));
  }

  // Check if the number is already reported
  const [isExistingNumber] = await db.query(
    "SELECT * FROM global_db WHERE number = ?",
    [number]
  );

  if (isExistingNumber.length > 0) {
    await db.query(
      "UPDATE global_db SET isSpam = isSpam + 1 WHERE number = ?",
      [number]
    );
  } else {
    const spamNumber = await db.query(
      "INSERT INTO global_db (number,isSpam) VALUES(?,?)",
      [number, 1]
    );

    if (!spamNumber) {
      return next(
        new ErrorHandler("Something went wrong.Please try again", 500)
      );
    }
  }
  res.status(200).json({
    success: true,
    message: "Report submitted successfully.",
  });
});

//-----------------------------------------------------------END-----------------------------------------------------------------------\\

//---------------------------------------------------Search User By Name----------------------------------------------------------------\\

export const searchName = catchAsyncError(async (req, res, next) => {
  let { name } = req.query;
  name = name.toLowerCase();

  const { userId } = req.cookies;

  if (!name) {
    return next(new ErrorHandler("Please enter the required fields.", 500));
  }

  // Search for names starting with the search query
  const dataStarting = await db.query(
    "SELECT * FROM global_db WHERE name LIKE ? ORDER BY name LIKE ? DESC",
    [`%${name}%`, `${name}%`]
  );

  // Search for names containing the search query but not starting with it
  const dataContaining = await db.query(
    "SELECT * FROM global_db WHERE name LIKE ? AND name NOT LIKE ? ORDER BY name",
    [`%${name}%`, `${name}%`]
  );

  const combinedData = [...dataStarting[0], ...dataContaining[0]];

  const result = [];

  // Total spam reports
  const spamReport = await db.query("SELECT * FROM global_db");
  const totalSpam = spamReport.length;

  for (let data of combinedData) {
    try {
      let user = await db.query("SELECT * FROM users WHERE name = ?", [
        data.name,
      ]);

      let contact = await db.query(
        "SELECT * FROM contacts WHERE name = ? AND authorized_id = ?",
        [data.name, userId]
      );

      const userData = [...user[0]];
      const contactData = [...contact[0]];

      let spamLikelihood = 0;

      // Calculate spam likelihood
      if (totalSpam > 0) {
        spamLikelihood = (totalSpam - data.isSpam + 1) / totalSpam;
      }

      if (userData.length > 0) {
        result.push({
          name: userData[0].name,
          number: userData[0].number,
          email: userData[0].email,
          spam: spamLikelihood,
        });
      }
      if (contactData.length > 0) {
        result.push({
          name: contactData[0].name,
          number: contactData[0].number,
          email: contactData[0].email,
          spamLikelihood,
        });
      }

      if (contactData.length === 0 && userData.length === 0) {
        result.push({
          name: data.name,
          number: data.number,
          spamLikelihood,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }

  // sorting the result array
  result.sort((a, b) => {
    const aStartsWith = a.name.startsWith(name);
    const bStartsWith = b.name.startsWith(name);

    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    return a.name.localeCompare(b.name);
  });

  res.status(200).json({
    success: true,
    message: "All data retrieved successfully",
    result,
  });
});

//-----------------------------------------------------------END-----------------------------------------------------------------------\\

//---------------------------------------------------Search User By Number---------------------------------------------------------------\\

export const serachNumber = catchAsyncError(async (req, res, next) => {
  const { number } = req.query;

  // checking number is provided by user or not
  if (!number) {
    return next(new ErrorHandler("Please provide required field", 403));
  }

  // Getting data from global_db
  const globalData = await db.query(
    "SELECT * FROM global_db WHERE number = ?",
    [number]
  );

  const result = [];

  // Total spam reports
  const spamReport = await db.query("SELECT * FROM global_db");
  const totalSpam = spamReport.length;

  if (globalData.length > 0) {
    // Running loop on globalData
    for (let data of globalData) {
      const registerData = await db.query(
        "SELECT * FROM users WHERE number = ?",
        [data[0].number]
      );

      let spamLikelihood = 0;

      // Calculate spam likelihood
      if (totalSpam > 0) {
        spamLikelihood = (totalSpam - data.isSpam + 1) / totalSpam;
      }
      const registeredData = [...registerData[0]];
      if (registeredData.length > 0) {
        result.push({
          name: registeredData[0].name,
          number: registeredData[0].number,
          email: registeredData[0].email,
          spamLikelihood,
        });
      }
    }
  }

  if (result.length == 0 && globalData.length > 0) {
    for (let data of globalData) {
      let spamLikelihood = 0;

      // Calculate spam likelihood
      if (totalSpam > 0) {
        spamLikelihood = (totalSpam - data[0].isSpam + 1) / totalSpam;
      }

      if (data[0].number !== undefined) {
        result.push({
          name: data[0].name,
          number: data[0].number,
          spamLikelihood,
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    message: "All data retrieved successfully",
    result,
  });
});

//------------------------------------------------------------END-------------------------------------------------------------------------\\

//-----------------------------------------------------------Logout------------------------------------------------------------------------\\

export const logoutUser = catchAsyncError(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.cookie("userId", null);

  res.status(200).json({
    success: true,
    message: "Logged Out",
  });
});

//--------------------------------------------------------------END-------------------------------------------------------------------------\\
