import mongoose, {isValidObjectId} from "mongoose"
import {ApiError} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Like} from "../models/like.models.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID")
    }

    const conditions = {video: videoId, likedBy: req.user?._id}

    const alreadyLiked = await Like.findOne(conditions)

    if (alreadyLiked) {
        await Like.findByIdAndDelete(alreadyLiked._id)

        return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: false }, "Like removed successfully."))

    } else {
        await Like.create(conditions)

        return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }, "Video liked successfully."))
    }
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID")
    }

    const conditions = {comment: commentId, likedBy: req.user?._id}

    const alreadyLiked = await Like.findOne(conditions)

    if (alreadyLiked) {
        await Like.findByIdAndDelete(alreadyLiked._id)

        return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: false }, "Like removed successfully."))

    } else {
        await Like.create(conditions)

        return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }, "Comment liked successfully."))
    }

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid Tweet ID")
    }

    const conditions = {tweet: tweetId, likedBy: req.user?._id}

    const alreadyLiked = await Like.findOne(conditions)

    if (alreadyLiked) {
        await Like.findByIdAndDelete(alreadyLiked._id)

        return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: false }, "Like removed successfully."))

    } else {
        await Like.create(conditions)

        return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true }, "Tweet liked successfully."))
    }
})

const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID")
    }

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Schema.Types.ObjectId(userId),
                video: { $exists: true }
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo",
                pipeline: [
                    {
                        $lookup: {
                            from: "User",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails"
                        }
                    },
                    {
                        $unwind: "$ownerDetails"
                    }
                ]
            }
        },
        {
            $unwind: "$likedVideo"
        },
        {
            $project: {
                _id: "$likedVideo._id",
                title: "$likedVideo.title",
                thumbnail: "$likedVideo.thumbnail",
                duration: "$likedVideo.duration",
                views: "$likedVideo.views",
                createdAt: "$likedVideo.createdAt",
                owner: {
                    _id: "$likedVideo.ownerDetails._id",
                    username: "$likedVideo.ownerDetails.username",
                    avatar: "$likedVideo.ownerDetails.avatar"
                }
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully."))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}