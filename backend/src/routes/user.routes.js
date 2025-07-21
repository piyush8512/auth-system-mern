import Router from 'express';
import { registerUser, loginUser,verifyMail, changePassword , resendEmailVerification,forgotPassword, resetPassword, getUser, updateUserProfile,refreshAccessToken, logOutUser} from '../controllers/user.controller.js';
import { userRegistrationValidator, userLoginValidator, userChangePasswordValidator, resendVerificationEmailValidator, forgotPasswordRequestValidator ,resetPasswordValidator} from '../validators/index.js';
import { validate } from '../middleware/validator.middleware.js';
import { isLoggedIn } from '../middleware/auth.middleware.js';

const router = Router();

router.route('/register').post(userRegistrationValidator(),validate,registerUser);
router.route("/verifyMail/:token").get(verifyMail);
router.route('/login').post(userLoginValidator(),validate,loginUser);

router.route("/changePassword").post(userChangePasswordValidator(),validate,isLoggedIn,changePassword);

router.route("/resendVerificationEmail").post(resendVerificationEmailValidator(),validate,resendEmailVerification);

router.route("/forgotPassword").post(forgotPasswordRequestValidator(),validate,forgotPassword);

router.route("/resetPassword/:token").post(resetPasswordValidator(),validate,resetPassword);

router.route("/getProfile").get(isLoggedIn,getUser);


router.route("/updateProfile").post(isLoggedIn,updateUserProfile);

router.route("/refreshAccessToken").get(refreshAccessToken);

router.route('/logout').post( isLoggedIn,logOutUser);
// router.route('/logout').post( verifyJWT,logoutUser);


//delete profile lateron


export default router;  