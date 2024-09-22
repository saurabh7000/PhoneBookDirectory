import app from "./app.js";
import dotenv from "dotenv";
import { mySqlPool } from "./config/database.js";

// config dotenv
dotenv.config();

const PORT = process.env.PORT || 5000;

//conditional listeining
mySqlPool
  .query("SELECT 1")
  .then(() => {
    console.log("MySQL database connected");
    const server = app.listen(PORT, () => {
      console.log(`Server running on port: ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
