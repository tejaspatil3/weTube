import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.models.js"
import {ApiError} from "../utils/apiError.js"
import {ApiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.models.js"

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

     if (!name || name.trim() === "") {
        throw new ApiError(400, "Playlist name is required")
    }
    if (!description) {
        throw new ApiError(400, "Playlist description is required")
    }
    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user?._id
    })
    if (!playlist) {
        throw new ApiError(500, "Failed to create the playlist. Please try again.")
    }
    return res.status(201).json(new ApiResponse(201, playlist, "Playlist created successfully")
    )

})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
 
    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID provided.")
    }
    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"
                },
                playlistThumbnail: {
                    $first: "$videos.thumbnail"
                }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                totalVideos: 1,
                playlistThumbnail: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    if (!playlists) {
        throw new ApiError(404, "User playlists could not be fetched.");
    }
    return res.status(200).json(new ApiResponse(200, playlists, "User playlists retrieved successfully")
    )
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    
    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID.");
    }
    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found.");
    }

    const playlistDetails = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerInfo"
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "videoOwnerInfo",
                        }
                    },
                    {
                        $unwind: "$videoOwnerInfo"
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            thumbnail: 1,
                            duration: 1,
                            views: 1,
                            videoOwner: {
                                username: "$videoOwnerInfo.username",
                                fullName: "$videoOwnerInfo.fullName",
                                avatar: "$videoOwnerInfo.avatar"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerInfo"
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                createdAt: 1,
                videos: 1,
                owner: {
                    _id: "$ownerInfo._id",
                    username: "$ownerInfo.username",
                    fullName: "$ownerInfo.fullName",
                    avatar: "$ownerInfo.avatar"
                },
                totalVideos: { $size: "$videos" }
            }
        }
    ])

    if (!playlistDetails?.length) {
        throw new ApiError(404, "Playlist not found or details could not be fetched.")
    }
    return res.status(200).json(new ApiResponse(200, playlistDetails[0], "Playlist retrieved successfully")
    )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid Playlist ID.")
    }
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID.")
    }
    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new ApiError(404, "Playlist not found.")
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found.")
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to add videos to this playlist.")
    }

    if (playlist.videos.includes(videoId)) {
        return res.status(200).json(new ApiResponse(200, playlist, "Video is already in the playlist.")
       )
    }
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $push: {
                videos: videoId
            }
        },
        { new: true } 
    );
    
    if (!updatedPlaylist) {
        throw new ApiError(500, "Failed to add video to the playlist. Please try again.")
    }
    return res.status(200).json(new ApiResponse(200, updatedPlaylist, "Video successfully added to playlist.")
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
   
    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid Playlist ID.")
    }
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID.")
    }

    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new ApiError(404, "Playlist not found.")
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to remove videos from this playlist.")
    }
    
    const videoIndex = playlist.videos.indexOf(new mongoose.Schema.Types.ObjectId(videoId))
    if (videoIndex === -1) {
        throw new ApiError(404, "Video not found in this playlist.")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId,
            },
        },
        { new: true }
    )

    if (!updatedPlaylist) {
        throw new ApiError(500, "Failed to remove video from the playlist. Please try again.")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video successfully removed from playlist.")
    )

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

     if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid Playlist ID.")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found.")
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this playlist.")
    }

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)

    if (!deletedPlaylist) {
        throw new ApiError(500, "Failed to delete the playlist, please try again.")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Playlist deleted successfully."))

})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body

    if (!mongoose.isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid Playlist ID.")
    }

    if (!name && !description) {
        throw new ApiError(400, "Name or description is required to update the playlist.")
    }
    
    if (name && name.trim() === "") {
        throw new ApiError(400, "Playlist name cannot be empty.")
    }
    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "Playlist not found.")
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to update this playlist.")
    }
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name: name || playlist.name,
                description: description || playlist.description
            }
        },
        { new: true }
    )

    if (!updatedPlaylist) {
        throw new ApiError(500, "Failed to update the playlist, please try again.")
    }
    return res
        .status(200)
        .json(new ApiResponse(200, updatedPlaylist, "Playlist updated successfully."))
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
