import bcrypt from "bcrypt";

//Encrypting passowrd
export const encryptPassword = async function (password) {
  return bcrypt.hash(password, parseInt(process.env.SALTROUND));
};

// Check if password already exists in the data base;
export const isPasswordExist = async function (results, password) {
  const flattenedResults = results.flat();

  // Loop through each object in the flattened results array
  for (let i = 0; i < flattenedResults.length; i++) {
    const hashedPassword = flattenedResults[i].password;

    // Compare the plaintext password with the hashed password
    if (
      hashedPassword !== undefined &&
      bcrypt.compareSync(password, hashedPassword)
    ) {
      // console.log("Password Match Found!");
      return true;
    }
  }

  return false;
};
