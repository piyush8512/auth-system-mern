import { User } from "../models/user.models.js";
import { ApiError } from "../utils/Api.error.js";
import { emailVerificationMailGenContent, sendMail , forgotPasswordMailGenContent} from "../utils/mail.js";
import jwt from "jsonwebtoken";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";


//registeruser
export const registerUser = asyncHandler(async function (req, res) {
  const { username, email, password, role } = req.body;
  try {
  if ([username, email, password].some((field) => !field || field.trim() === "")) {
  throw new ApiError(400, "All fields are required");
}

    const existedUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    });

    if (existedUser) {
      throw new ApiError(400, "User already exists");
    }
    const allowedPublicRoles = ["user"];
    const requestedRole = (role || "user").toLowerCase();
    if (!allowedPublicRoles.includes(requestedRole)) {
      throw new ApiError(400, "Invalid role");
    }
    const user = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      role: requestedRole,
    });
    // const safeUser = await User.findById(user._id).select("-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiry");

    const { hashedToken, tokenExpiry } = user.generateTemporaryToken();
    let verificationURL = `${process.env.Base_URL}/api/v1/users/verify-email/${hashedToken}`;
    let expiryDateFormatted = new Date(tokenExpiry);
    const mailGenContent = emailVerificationMailGenContent(
      user.username,
      verificationURL,
      expiryDateFormatted.toLocaleString()
    );

    await sendMail({
      email: user.email,
      subject: "Email Verification",
      mailGenContent,
    });
    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tokenExpiry;
    await user.save();

    return res
      .status(201)
      .json(new ApiResponse(201, user, "User created successfully"));
  } catch (error) {
    console.log(error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      statusCode: 500,
      message: "Something went wrong",
      success: false,
    });
  }
});

//verify mail
export const verifyMail = asyncHandler(async function (req, res) {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
    });
    if (!user) {
      throw new ApiError(400, "Invalid verification token");
    }

    if (Date.now() > user.emailVerificationTokenExpiry) {
      throw new ApiError(400, "Verification token expired");
    }
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {
            id: user._id,
            username: user.username,
            isVerified: user.isEmailVerified,
          },
          "Email verified successfully"
        )
      );
  } catch (error) {
    console.log(error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      statusCode: 500,
      message: "Something went wrong while verifying user ",
      success: false,
    });
  }
});

//login
export const loginUser = asyncHandler(async function (req, res) {
  const { email, username, password } = req.body;

  try {
    if (!username && !email) {
      throw new ApiError(400, "Username or email is required");
    }
    if (!password) {
      throw new ApiError(400, "Password is required");
    }
    const user = await User.findOne({
      $or: [
        { username: username?.toLowerCase() },
        { email: email?.toLowerCase() },
      ],
    });
    if (!user) {
      throw new ApiError(404, "User does not exist");
    }
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid user credentials");
    }
    if (!user.isEmailVerified) {
      throw new ApiError(401, "Verify your Email before login");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie("accessToken", accessToken, options);
    res.cookie("refreshToken", refreshToken, options);
    user.refreshToken = refreshToken;
    await user.save();
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { id: user._id, username: user.username, email: user.email },
          "User logged In successfully"
        )
      );
  } catch (error) {
    console.log("Login error", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: "Something went wrong while logging the User",
    });
  }
});

//change current password
export const changePassword = asyncHandler(async function (req, res) {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?._id;

  try {
    if (!userId) {
      throw new ApiError(401, "User is not authenticated.");
    }

    if (!oldPassword || !newPassword) {
      throw new ApiError(400, "Both old password and new password are required.");
    }

    if (oldPassword === newPassword) {
      throw new ApiError(400, "New password cannot be the same as the old password.");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters long.");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "Authenticated user not found in database.");
    }

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid user credentials.");
    }

    user.password = newPassword;
    user.refreshToken = undefined;
    await user.save({ validateBeforeSave: true });

    res.status(200).json(
      new ApiResponse(
        200,
        { id: user._id, username: user.username, email: user.email },
        "Password changed successfully. Please log in again with your new password."
      )
    );
  } catch (error) {
    console.error("Change password error:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: "Something went wrong while changing your password. Please try again later.",
    });
  }
});

//resend email verification
export  const resendEmailVerification = asyncHandler(async function (req, res){

  const {username, email, password} =  req.body;
  try{
    let user = undefined
    if (email) {
      user = await db.User.findOne({ email: email.toLowerCase() });
    }else if (username) {
      user = await db.User.findOne({ username: username.toLowerCase() });
    }
    if (!user) {
      throw new ApiError(404, "User does not exist");
    }
     const isCorrect = await user.isPasswordCorrect(password);
     console.log(isCorrect)

        if (!isCorrect) {
            throw new ApiError(401, "Wrong password")
        }
    if(user.isEmailVerified) {
      throw  new ApiError(400, "Email is already verified");
    
    }
    const { hashedToken, tokenExpiry } = generateTemporaryToken();


    let verificationURL = process.env.BASE_URL + "/api/v1/auth/verifyMail/" + hashedToken;
    let expiryDateFormatted = new Date(tokenExpiry);
    const mailGenContent = emailVerificationMailGenContent(user.username, verificationURL, expiryDateFormatted.toLocaleString());
    await sendMail({ email: user.email, subject: "Email Verification link", mailGenContent });

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = tokenExpiry;
    await user.save();



    res.status(200).json(
      new ApiResponse(
        200,
        {  username: user.username, email: user.email, isVerified: user.isEmailVerified,
      },
        "Email verification link sent successfully"
      )
    );
  }catch(error){
    console.error("Error in resend email verification", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: "Something went wrong while sending email verification link. Please try again later.",
    });
  }

  
})

//forgotpassword
export const forgotPassword = asyncHandler(async function (req, res) {
  const { email, username } = req.body;
  try{
    let user = undefined;
    if (email){
      user = await User.findOne({ email: email.toLowerCase() });
    }else if (username){
      user = await User.findOne({ username: username.toLowerCase() });
    }
    if (!user) {
      throw new ApiError(404, "404 Not Found");
    }
    const { hashedToken, tokenExpiry } = user.generateTemporaryToken();
    const formattedData =  new Date(tokenExpiry);
    const resetPasswordURL = process.env.BASE_URL + "/api/v1/auth/resetPassword/" + hashedToken;

    const mailGenContent = forgotPasswordMailGenContent(user.username, resetPasswordURL, formattedData.toLocaleString());
    await sendMail({ email: user.email, subject: "Reset Password link", mailGenContent });
    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordTokenExpiry = tokenExpiry;
    await user.save();
    res.status(200).json(
      new ApiResponse(
        200,
        {  username: user.username, email: user.email, isVerified: user.isEmailVerified,
      },
        "Reset password link sent successfully"
      )
    );

  }catch(error){
    console.error("Error in forgot password", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: "Something went wrong while sending reset password link. Please try again later.",
    });
  }
})

//reset password
export const resetPassword = asyncHandler(async function (req, res) {
  const {token} = req.params;
  const {newPassword} = req.body;
  try{
    const user = await User.findOne({
      forgotPasswordToken: token,
    })
    if(!user)
    {
      throw new ApiError(404, "Invalid or expired token");
    }
    const expiry  = user.forgotPasswordTokenExpiry
    if(Date.now() > expiry){
      throw new ApiError(400, "Token has been expired");
    }
    user.forgotPasswordToken = undefined;
    user.forgotPasswordTokenExpiry = undefined;

    
    user.password = newPassword;
    await user.save();
    res.status(200).json(
      new ApiResponse(
        200,
        {  username: user.username, email: user.email, isVerified: user.isEmailVerified,
      },
        "Password reset successfully"
      )
    );

  }catch(error){
    console.error("Error in reset password", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: "Something went wrong while resetting password. Please try again later.",
    });
    
  }
})

//getUser
export const getUser = asyncHandler(async function (req, res) {
  try {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized access");
    }

    const myUser = await User.findById(req.user._id);

    if (!myUser) {
      throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          name: myUser.name,
          email: myUser.email,
          username: myUser.username,
          avatar: myUser.avatar,
          role: myUser.role,
          isEmailVerified: myUser.isEmailVerified,
        },
        "User fetched successfully"
      )
    );
  } catch (error) {
    console.error("Error in getUser:", error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: "Something went wrong while fetching the user. Please try again later.",
    });
  }
});

//update User
export const updateUserProfile = asyncHandler(async function (req, res) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized access");
  }

  const { name, avatar } = req.body;

  try {
    const myUser = await User.findById(req.user._id);

    if (!myUser) {
      throw new ApiError(404, "User not found");
    }

    let isUpdated = false;

    if (name && myUser.name !== name) {
      myUser.name = name;
      isUpdated = true;
    }

    if (req.file && req.file.path) {
      myUser.avatar = req.file.path;
      isUpdated = true;
    } else if (avatar && myUser.avatar !== avatar) {
      myUser.avatar = avatar;
      isUpdated = true;
    }

    if (!isUpdated) {
      throw new ApiError(400, "No valid data provided for profile update.");
    }

    await myUser.save();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          name: myUser.name,
          email: myUser.email,
          username: myUser.username,
          avatar: myUser.avatar,
          isEmailVerified: myUser.isEmailVerified,
        },
        "User profile updated successfully"
      )
    );
  } catch (error) {
    console.error("Error in updateUserProfile:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: "Something went wrong while updating the user profile. Please try again later.",
    });
  }
});

//refresh token
export const refreshAccessToken = asyncHandler(async function (req, res) {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new ApiError(401, "Login required");
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const myUser = await User.findById(decoded._id);

    if (!myUser) {
      throw new ApiError(401, "Invalid refresh token - User not found");
    }

    const accessToken = myUser.generateAccessToken();

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    };

    res.cookie("accessToken", accessToken, cookieOptions);

    return res.status(200).json(
      new ApiResponse(200, { accessToken }, "Access token refreshed successfully")
    );

  } catch (error) {
    console.error("Error refreshing token:", error);

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        statusCode: 401,
        message: "Refresh token expired. Please log in again.",
        success: false,
      });
    }

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      });
    }

    return res.status(500).json({
      statusCode: 500,
      message: "Something went wrong while refreshing access token",
      success: false,
    });
  }
});

//logoutuser
export const logOutUser = asyncHandler(async function(req, res) {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    res.clearCookie('refreshToken', { httpOnly: true, secure: true });
    res.clearCookie('accessToken', { httpOnly: true, secure: true });
    throw new ApiError(400, "No active session or already logged out");
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    res.clearCookie('refreshToken', { httpOnly: true, secure: true });
    res.clearCookie('accessToken', { httpOnly: true, secure: true });

    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Refresh token expired. Please log in again.");
    }
    throw new ApiError(401, "Invalid refresh token. Please log in again.");
  }

  const myUser = await User.findById(decoded._id);

  if (!myUser) {
    res.clearCookie('refreshToken', { httpOnly: true, secure: true });
    res.clearCookie('accessToken', { httpOnly: true, secure: true });
    throw new ApiError(401, "Invalid refresh token - User not found");
  }

  myUser.refreshToken = undefined;
  await myUser.save({ validateBeforeSave: false });

  res.clearCookie('refreshToken', { httpOnly: true, secure: true });
  res.clearCookie('accessToken', { httpOnly: true, secure: true });

  return res.status(200).json(
    new ApiResponse(200, {}, "Logged Out Successfully")
  );
});

