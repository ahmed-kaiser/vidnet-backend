import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  if (isNaN(parseInt(page)) || isNaN(parseInt(limit))) {
    throw new ApiError(400, "Invalid page or limit value");
  }

  page = Math.max(1, parseInt(page));
  limit = Math.max(1, parseInt(limit));

  const skip = Math.max(0, (page - 1) * limit);

  let comments;
  try {
    comments = await Comment.aggregate([
      {
        $match: { video: videoId },
      },
      {
        $lookup: {
          from: "users",
          foreignField: "_id",
          localField: "user",
          as: "user",
          pipeline: [
            {
              $project: {
                fullName: 1,
                avater: 1,
                createdAt: 1,
              },
            },
            {
              $addFields: {
                user: {
                  $first: "$user",
                },
              },
            },
          ],
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { comments }, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  const { content, video, owner } = req.body;

  if (content.trim() === "") {
    throw new ApiError(400, "Comment content is require");
  }

  if (!video) {
    throw new ApiError(400, "Video ID is require");
  }

  if (!owner) {
    throw new ApiError(400, "Owner ID is require");
  }

  if (isValidObjectId(video)) {
    throw new ApiError(400, "Invalid video ID");
  }

  if (isValidObjectId(owner)) {
    throw new ApiError(400, "Invalid owner ID");
  }

  if (owner !== req.user._id) {
    throw new ApiError(401, "Unauthorize request");
  }

  let comment;
  try {
    comment = await Comment.create({
      content,
      video,
      owner,
    });
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  if (!comment) {
    throw new ApiError(500, "Failed to add comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { comment }, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (content.trim() === "") {
    throw new ApiError(400, "Comment content is require");
  }

  let comment;
  try {
    comment = await Comment.findById(commentId);
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner !== req.user._id) {
    throw new ApiError(401, "Unauthorize request");
  }

  let updatedComment;
  try {
    comment.content = content;
    updatedComment = comment.save();
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { comment: updatedComment },
        "Comment updated successfully"
      )
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  let comment;
  try {
    comment = await Comment.findById(commentId);
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner !== req.user._id) {
    throw new ApiError(401, "Unauthorize request");
  }

  try {
    comment.delete();
  } catch (error) {
    throw new ApiError(500, "Server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
