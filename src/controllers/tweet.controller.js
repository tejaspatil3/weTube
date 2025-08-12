import mongoose, { isValidObjectId } from "mongoose"
import {ApiError} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {User} from "../models/user.models.js"
import {Tweet} from "../models/tweet.models.js"

const createTweet = asyncHandler(async (req, res) => {
    
    const { content } = req.body
    if (!content || content.trim() === "") {
        throw new ApiError(400, "Tweet content cannot be empty")
    }
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "User not authenticated")
    }
    const tweet = await Tweet.create({
        content,
        owner: userId,
    })
    if (!tweet) {
        throw new ApiError(500, "Something went wrong while creating the tweet")
    }
    return res
        .status(201)
        .json(new ApiResponse(201, tweet, "Tweet created successfully"))

})

const getUserTweets = asyncHandler(async (req, res) => {

    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const { page = 1, limit = 10 } = req.query;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { createdAt: -1 },
    };

    const tweets = await Tweet.aggregatePaginate(
        Tweet.aggregate([
            {
                $match: {
                    owner: new mongoose.Schema.Types.ObjectId(userId),
                },
            },
            {
                $lookup: {
                    from: "User",
                    localField: "owner",
                    foreignField: "_id",
                    as: "ownerDetails",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                avatar: 1,
                            },
                        },
                    ],
                },
            },
            {
                $unwind: "$ownerDetails",
            },
        ]),
        options
    );

    if (!tweets || tweets.docs.length === 0) {
        return res
            .status(200)
            .json(new ApiResponse(200, [], "User has no tweets yet"))
    }

    return res
        .status(200)
        .json(new ApiResponse(200, tweets, "User tweets fetched successfully"))
})

const updateTweet = asyncHandler(async (req, res) => {
     const { tweetId } = req.params
    const { content } = req.body

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Content cannot be empty")
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this tweet")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content: content,
            },
        },
        { new: true }
    );

    if (!updatedTweet) {
        throw new ApiError(500, "Something went wrong while updating the tweet")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"))
})

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    if (tweet.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this tweet")
    }

    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

    if (!deletedTweet) {
        throw new ApiError(500, "Something went wrong while deleting the tweet")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Tweet deleted successfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
