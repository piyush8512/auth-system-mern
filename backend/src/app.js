import express from "express";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.routes.js";

import cors from "cors";
import dotenv from "dotenv";

const app = express();
dotenv.config();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    })
  );



app.use("/api/v1/users", userRoutes);




export default app;





