const permissionModel = require("../models/permissionModel");
const userModel = require("../models/userModel");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { getSelectedRoleInAccessToken } = require("../utils");

exports.get = function (req, res, next) {
  const { type } = req.query;
  let query = {};

  // query pagination
  const page = parseInt(req.query.pageIndex) || 1;
  let pageSize = parseInt(req.query.pageSize) || 20;

  if (type) {
    query = { ...query, type };
  }
  permissionModel.aggregate(
    [
      { $match: query },
      {
        $lookup: {
          from: "roles",
          let: { ids: "$accessList" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$ids"],
                },
              },
            },
            {
              $project: {
                name: 1,
              },
            },
          ],
          as: "accessList",
        },
      },
    ],
    (err, data) => {
      if (err) {
        next(err);
      } else {
        res.json(data);
      }
    }
  );
};

exports.getByUserId = async function (req, res, next) {
  const { userId } = req.params;

  const role = getSelectedRoleInAccessToken(req);
  const roleObjId = mongoose.Types.ObjectId(role);

  try {
    const userObjId = mongoose.Types.ObjectId(userId);
    const data = await userModel.aggregate([
      {
        $match: {
          _id: userObjId,
        },
      },
      // {
      //   $addFields: {
      //     role: "$role._id",
      //   },
      // },
      {
        $addFields: {
          role: {
            $filter: {
              input: "$role",
              as: "roles",
              cond: { $eq: ["$$roles._id", roleObjId] },
            },
          },
        },
      },
      {
        $lookup: {
          from: "permissions",
          let: { roleIds: "$role" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $gt: [
                    {
                      $size: { $setIntersection: ["$accessList", "$$roleIds"] },
                    },
                    0,
                  ],
                },
              },
            },
            {
              $project: {
                code: 1,
              },
            },
          ],
          as: "access",
        },
      },
      {
        $unwind: {
          path: "$access",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: 1,
          access: {
            $addToSet: "$access.code",
          },
        },
      },
    ]);

    console.log("data", data);
    if (data[0]) {
      const { access } = data[0];

      return res.json({ success: true, data: access });
    }

    res.json({ success: true, data: [] });
  } catch (error) {
    console.log("error get by user id", error);
    res.status(403).json({ success: false, message: "Something's wrong!" });
  }
};

exports.add = function (req, res, next) {
  const new_data = new permissionModel(req.body);

  new_data.save(function (err, result) {
    if (err) next(err);
    else
      res.json({
        status: "success",
        message: "Page added successfully!!!",
        // data: result,
      });
  });
};

exports.update = function (req, res, next) {
  permissionModel.findOneAndUpdate(
    { _id: req.params._id },
    { $set: req.body },
    { new: true },
    (err, data) => {
      if (err) {
        next(err);
      } else {
        res.status(200).json({ status: "success", message: "Page updated" });
      }
    }
  );
};

exports.delete = function (req, res, next) {
  permissionModel.findOneAndDelete(
    { _id: req.params._id },
    async (err, data) => {
      if (err) {
        next(err);
      } else {
        res.status(200).json({
          status: "success",
          message: "success deleted Page",
          data,
        });
      }
    }
  );
};
