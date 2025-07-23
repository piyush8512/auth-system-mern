class ApiError extends Error {
    constructor (
        statusCode,
        message = "Something went Wrong",
        errors = [],
        stack = ""
    )
    {
        super (message)
        this.statusCode = statusCode;
        this.message = message;
        this.success = statusCode<400;  // #dimag
        this.errors = errors;
        if(stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}