import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
   
       const videoAggregate = Video.aggregate([
        {
            $match: {
                isPublished: true,
                ...(userId && mongoose.isValidObjectId(userId) && { owner: new mongoose.Schema.Types.ObjectId(userId) }),
                ...(query && {
                    $or: [
                        { title: { $regex: query, $options: "i" } },
                        { description: { $regex: query, $options: "i" } },
                    ],
                }),
            },
        },
        {
            $sort: sortBy && sortType
                ? { [sortBy]: sortType === "asc" ? 1 : -1 }
                : { createdAt: -1 },
        },
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const videos = await Video.aggregatePaginate(videoAggregate, options);

    if (!videos || videos.docs.length === 0) {
        return res
            .status(200)
            .json(new ApiResponse(200, [], "No videos found for the given criteria"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"));
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body;
    
    if(!title || !description){
        throw new ApiError(400,"Something went wrong")
    }
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required")
    }
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required")
    }
    
    // const videoFile = await uploadOnCloudinary(videoFileLocalPath, "video")
    // const thumbnail = await uploadOnCloudinary(thumbnailLocalPath, "video")

    let videoFile;
    try{
        videoFile = await uploadOnCloudinary(videoFileLocalPath, "video")
        console.log("Uploaded video\n", videoFile)

    }catch(error){
        console.log("Error uploading video",error)
        throw new ApiError(500, "Failed to upload video")
    }

    let thumbnail;
    try{
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath, "video")
        console.log("Uploaded thumbnail\n", thumbnail)

    }catch(error){
        console.log("Error uploading thumbnail",error)
        throw new ApiError(500, "Failed to upload thumbnail")
    }
    
    const video = await Video.create({
        title,
        description,
        videoFile: {
            public_id: videoFile.public_id,
            url: videoFile.url
        },
        thumbnail: {
            public_id: thumbnail.public_id,
            url: thumbnail.url
        },
        duration: videoFile.duration,
        owner: req.user?._id,
        isPublished: true,
    });
    
    if (!video) {
        throw new ApiError(500, "Something went wrong while saving the video to the database please retry")
    }
    
    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video published successfully"))

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID format.")
    }
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    return res
        .status(200)
        .json(new ApiResponse(200, video.select("-api_key"), "Video fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    const thumbnailLocalPath = req.file?.path

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID format")
    }

    if(!title || !description || !thumbnailLocalPath){
        throw new ApiError(400, "Atleast one field is required to update")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video")
    }

    let oldThumbnailUrl = video.thumbnail;

    if (thumbnailLocalPath) {

        const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath, "video")
        if (!uploadedThumbnail?.public_id) {
            throw new ApiError(500, "Error while uploading new thumbnail")
        }
        newThumbnail = { 
            public_id: uploadedThumbnail.public_id,
            url: uploadedThumbnail.url 
        }
        
        if (video.thumbnail?.public_id) {
            try {
                await cloudinary.uploader.destroy(video.thumbnail.public_id, {
                    resource_type: "image"
                });
            } catch (error) {
                console.error("Failed to delete old thumbnail from Cloudinary", error);
            }
        }
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title: title || video.title, 
                description: description || video.description,
                thumbnail: newThumbnail,
            }
        },
        { new: true }
    )
     if (!updatedVideo) {
        throw new ApiError(500, "Failed to update video details on the database")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video details updated successfully"))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!mongoose.isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid videoId Format")
    }
    
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(400,"Video not found")
    }
    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video")
    }
    if (video.videoFile?.public_id) {
        await cloudinary.uploader.destroy(video.videoFile.public_id, {
            resource_type: "video"
        })
    }
    if (video.thumbnail?.public_id) {
        await cloudinary.uploader.destroy(video.thumbnail.public_id, {
            resource_type: "image"
        })
    }
    const deleteResult = await Video.findByIdAndDelete(videoId);

    if (!deleteResult) {
        throw new ApiError(500, "Failed to delete the video from the database");
    }
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!mongoose.isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid videoId")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(400,"video not found")
    }
    if(video.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(403, "You are not authorized to change the publish status of this video")
    }
    video.isPublished = !video.isPublished
    await video.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200,{ isPublished: video.isPublished },"Video publish status toggled successfully")
        )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
