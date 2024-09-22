import express, { json } from "express";
import userRoutes from "./routes/routes.js";
import errorMiddleware from "./middlewares/error.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(json());
app.use(cookieParser());

// All routes
app.use("/api/v1/", userRoutes);

// Error handler middleware
app.use(errorMiddleware);

export default app;
