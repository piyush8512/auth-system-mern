import { validationResult } from "express-validator"
import {ApiError} from "../utils/Api.error.js";
import mongoose from "mongoose";


export const  validate = (req, res, next) => {
    const error = validationResult(req);
    if (error.isEmpty() )return next();

    else
    {
        const extractedErrors = error.array().map((err)=>{
            return {
                [err.path]: [err.msg]
            }
        })
        console.log(extractedErrors)
        throw new ApiError(422, "Recived invalid data", extractedErrors);
    }
}