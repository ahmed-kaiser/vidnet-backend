import { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { title, description, visibility } = req.body;

  if (title.trim() === "") {
    throw new ApiError(400, "Title is required");
  }

  const playlist = await Playlist.create({
    title,
    description,
    visibility,
    owner: req.user._id,
  });

  if (!playlist) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { playlist }, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //TODO: get user playlists
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(400, "The playlist does not exist");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "The video does not exist");
  }

  if (
    playlist.owner !== req.user._id ||
    video.owner !== req.user._id ||
    playlist.owner !== video.owner
  ) {
    throw new ApiError(401, "Unauthorized request");
  }

  if (!playlist.videos) {
    playlist.videos = [];
  }

  try {
    playlist.videos.push(videoId);
    await playlist.save();
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video added to the playlist successfully"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(400, "The playlist does not exist");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "The video does not exist");
  }

  if (
    playlist.owner !== req.user._id ||
    video.owner !== req.user._id ||
    playlist.owner !== video.owner
  ) {
    throw new ApiError(401, "Unauthorized request");
  }

  const Playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: { videos: videoId },
    },
    { new: true }
  );

  if (!playlist) {
    throw new ApiError(500, "Server error");
  }

  return (
    res.status(200),
    json(new ApiResponse(200, {}, "Removed video from playlist successfully"))
  );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(400, "The playlist does not exist");
  }

  if (playlist.owner !== req.user._id) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    await playlist.delete();
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { title, description, visibility } = req.body;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist ID");
  }

  if (title.trim() === "") {
    throw new ApiError(400, "Title is required");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: { title, description, visibility },
    },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { playlist: updatePlaylist },
        "Playlist updated successfully"
      )
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
