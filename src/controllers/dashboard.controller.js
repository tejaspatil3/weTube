import mongoose from "mongoose"
import {Video} from "../models/video.models.js"
import {Subscription} from "../models/subscription.models.js"
import {Like} from "../models/like.models.js"
import {ApiError} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {

    if (!req.user?._id) {
        throw new ApiError(400, "User not found")
    }

    const userId = req.user._id

    const totalSubscribers = await Subscription.countDocuments({
        channel: userId,
    })

    const videoStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Schema.Types.ObjectId(userId),
            },
        },
        {
            $lookup: {
                from: "Like",
                localField: "_id",
                foreignField: "video",
                as: "likes",
            },
        },
        {
            $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalViews: { $sum: "$views" },
                totalLikes: { $sum: { $size: "$likes" } },
            },
        },
        {
            $project: {
                _id: 0,
                totalVideos: 1,
                totalViews: 1,
                totalLikes: 1,
            },
        },
    ])

    const stats = {
        totalSubscribers,
        totalVideos: videoStats[0]?.totalVideos || 0,
        totalViews: videoStats[0]?.totalViews || 0,
        totalLikes: videoStats[0]?.totalLikes || 0,
    }
    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Channel stats fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    if (!req.user?._id) {
        throw new ApiError(400, "User not found")
    }

    const userId = req.user._id;

    const videos = await Video.find({ owner: userId })

    if (!videos || videos.length === 0) {
        return res
            .status(200)
            .json(new ApiResponse(200, [], "No videos found for this channel yet"))
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Channel videos fetched successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
    }