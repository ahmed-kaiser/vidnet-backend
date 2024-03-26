import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (title.trim() === "") {
    throw new ApiError(400, "Title is required");
  }

  if (description.trim() === "") {
    throw new ApiError(400, "Description is required");
  }

  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLOcalPath = req.files?.thumbnail[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is required");
  }

  if (!thumbnailLOcalPath) {
    throw new ApiError(400, "Thumbnail file is required");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLOcalPath);

  if (!videoFile) {
    throw new ApiError(500, "Failed to upload video please try again");
  }

  if (!thumbnail) {
    throw new ApiError(
      500,
      "Failed to upload thumbnail image please try again"
    );
  }

  const video = await Video.create({
    title,
    description,
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    duration: videoFile.duration,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(500, "Failed to publish video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { video }, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  let video;
  try {
    video = await Video.findById(videoId);
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  if (!video) {
    throw new ApiError(400, "Video does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { video }, "Video found successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
