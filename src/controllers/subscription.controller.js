import mongoose, {isValidObjectId} from "mongoose"
import {ApiError} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Subscription} from "../models/subscription.models.js"
import {User} from "../models/user.models.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    const userId = req.user?._id
    if (!mongoose.isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID provided")
    }
    if (channelId.toString() === userId.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel")
    }
    const existingSubscription = await Subscription.findOne({
        subscriber: userId,
        channel: channelId
    })
    if (existingSubscription) {
        await Subscription.findByIdAndDelete(existingSubscription._id)

        return res
            .status(200)
            .json(new ApiResponse(200, {}, "Successfully unsubscribed from the channel."))
    } else {
        const newSubscription = await Subscription.create({
            subscriber: userId,
            channel: channelId
        })
        if (!newSubscription) {
            throw new ApiError(500, "Failed to subscribe to the channel. Please try again.")
        }
        return res
            .status(201)
            .json(new ApiResponse(201, newSubscription, "Successfully subscribed to the channel."))
    }
})

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
     if (!mongoose.isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid Channel ID");
    }

    const channelExists = await User.findById(channelId);
    if (!channelExists) {
        throw new ApiError(404, "Channel not found");
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId),
            },
        },
        {
            $lookup: {
                from: "User",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriberDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                            createdAt: 1,
                            updatedAt: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscriberDetails",
        },
        {
            $replaceRoot: { newRoot: "$subscriberDetails" },
        },
    ])

    if (!subscribers) {
        throw new ApiError(500, "Failed to fetch subscribers")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribers,
                "Subscribers fetched successfully"
            )
        )
})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!mongoose.isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid Subscriber ID")
    }

    const userExists = await User.findById(subscriberId);
    if (!userExists) {
        throw new ApiError(404, "User not found")
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Schema.Types.ObjectId(subscriberId),
            },
        },
        {
            $lookup: {
                from: "User",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannelDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscribedChannelDetails",
        },
        {
            $replaceRoot: { newRoot: "$subscribedChannelDetails" },
        },
    ])

    if (!subscribedChannels) {
        throw new ApiError(500, "Failed to fetch subscribed channels")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribedChannels,
                "Subscribed channels fetched successfully"
            )
        )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}