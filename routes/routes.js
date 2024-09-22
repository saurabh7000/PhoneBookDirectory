import { Router } from "express";
import {
  login,
  logoutUser,
  register,
  reportSpam,
  searchName,
  serachNumber,
} from "../controllers/controller.js";
import { authorized } from "../middlewares/authorized.js";

const router = Router();

// route for creating new user
router.route("/create").post(register);

// login user
router.route("/login").get(login);

// logout user
router.route("/logout").get(authorized, logoutUser);

// route to add spam number
router.route("/report").post(authorized, reportSpam);

// search user by name
router.route("/search/name").get(authorized, searchName);

// search user by number
router.route("/search/number").get(authorized, serachNumber);

export default router;
