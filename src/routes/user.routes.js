import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js"
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

//no jwt
router.route("/register").post(
    upload.fields([
        {
            name : "avatar",
            maxCount: 1
        },{
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)
router.route("/refresh-token").post(refreshAccessToken)
 
// with jwt
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/change-user-password").post(verifyJWT,changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-user-account").patch(verifyJWT,updateAccountDetails)
router.route("/update-user-avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar)
router.route("/update-user-cover-image").patch(verifyJWT,upload.single("coverImage"),updateUserCoverImage)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/user-watch-history").get(verifyJWT,getWatchHistory)


//test video
// import {getVideoById,publishAVideo,updateVideo,deleteVideo,togglePublishStatus, getAllVideos} from "../controllers/video.controller.js"

// router.route("get-all-videos").get(getAllVideos)

// router.route("/publish-video").post(
//         upload.fields([
//         {
//             name : "videoFile",
//             maxCount: 1
//         },{
//             name: "thumbnail",
//             maxCount: 1
//         }
//     ]),
//     publishAVideo)
// router.route("get-video/:videoId").get(getVideoById)
// router.route("/update-video/:videoId").patch(updateVideo)
// router.route("/delete-video/:videoId").delete(deleteVideo)
// router.route("/toggle-publish/:videoId").patch(togglePublishStatus)


export default router