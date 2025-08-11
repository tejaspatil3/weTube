import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js"
import {getVideoById,publishAVideo,updateVideo,deleteVideo,togglePublishStatus, getAllVideos} from "../controllers/video.controller.js"
const router = Router()

router.route("get-all-videos").get(getAllVideos)

router.route("/publish-video").post(
        upload.fields([
        {
            name : "videoFile",
            maxCount: 1
        },{
            name: "thumbnail",
            maxCount: 1
        }
    ]),
    publishAVideo)
router.route("/get-video/:videoId").get(getVideoById)
router.route("/update-video/:videoId").patch(updateVideo)
router.route("/delete-video/:videoId").post(deleteVideo)
router.route("/toggle-publish/:videoId").patch(togglePublishStatus)


// router.route("get-all-videos").get(getAllVideos)

// router.route("/videos/:videoId")
//     .get(getVideoById) 
//     .patch(updateVideo)
//     .delete(deleteVideo)

// router.route("/videos/:videoId/toggle-publish").patch(togglePublishStatus)



export default router