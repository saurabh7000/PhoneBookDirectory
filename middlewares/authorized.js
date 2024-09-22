import jwt from "jsonwebtoken";
import ErrorHandler from "./ErrorHandler.js";

export const authorized = (req, res, next) => {
  const { token } = req.cookies;

  // checking if token exists or not
  if (!token) {
    return next(
      new ErrorHandler(
        "Access denied.Please log in to access this resource",
        401
      )
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (ex) {
    next(new ErrorHandler("Invalid token.", 400));
  }
};
