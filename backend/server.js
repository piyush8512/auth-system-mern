import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";


import connectDB from "../config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import { connect } from "mongoose";


const app =express();
const port = process.env.PORT || 3000;
connectDB();

const allowedOrigin = [
    "http://localhost:5173",
];

app.use(express.json());
app.use(cookieParser());
app.use(cors({origin:allowedOrigin, credentials:true}));

//api
app.use("/",(req,res)=> res.send("API working"));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/user/", userRouter);


app.listen(port, () => consol.log(`server running on PORT  ${port}`));