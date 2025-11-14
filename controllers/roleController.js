const roleModel = require("../models/roleModel");
const userModel = require("../models/userModel");
const mongoose = require("mongoose");

exports.getRole = function (req, res, next) {
  const { name, division, departement, roles } = req.query;
  console.log("query", req.query);
  let query = {};

  if (name) {
    query = {
      ...query,
      name: {
        $regex: name,
        $options: "i",
      },
    };
  }
  if (division) {
    query = {
      ...query,
      division,
    };
  }
  if (departement) {
    query = {
      ...query,
      departement,
    };
  }
  if (roles) {
    const objIds = roles.map((i) => mongoose.Types.ObjectId(i));
    query = {
      ...query,
      _id: { $in: objIds },
    };
  }
  // roleModel.aggregate(
  //   [
  //     {
  //       $addFields: {
  //         divisionId: {
  //           $convert: {
  //             input: "$division",
  //             to: "objectId",
  //             onError: "$division",
  //             onNull: "None",
  //           },
  //         },
  //         departementId: {
  //           $convert: {
  //             input: "$departement",
  //             to: "objectId",
  //             onError: "$departement",
  //             onNull: "None",
  //           },
  //         },
  //       },
  //     },
  //     {
  //       $lookup: {
  //         from: "departements",
  //         localField: "departementId",
  //         foreignField: "_id",
  //         as: "_departement",
  //       },
  //     },
  //     {
  //       $lookup: {
  //         from: "departements",
  //         localField: "departementId",
  //         foreignField: "_id",
  //         as: "_departement",
  //       },
  //     },
  //     {
  //       $unwind: {
  //         path: "$_departement",
  //         // includeArrayIndex: "string",
  //         preserveNullAndEmptyArrays: true,
  //       },
  //     },
  //     {
  //       $project: {
  //         name: 1,
  //         sidebarMenu: 1,
  //         permissions: 1,
  //         accessLevel: 1,
  //         departement: 1,
  //         createdAt: 1,
  //       },
  //     },
  //   ],
  //   (err, data) => {
  //     if (err) {
  //       next(err);
  //     } else {
  //       res.json(data);
  //     }
  //   }
  // );

  roleModel.find(query, (err, data) => {
    if (err) {
      next(err);
    } else {
      // console.log("getRole", data);
      res.json(data);
    }
  });
};

exports.getHomeMenu = function (req, res, next) {
  const { _id: userId } = req.params;

  userModel.aggregate(
    [
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $addFields: {
          role: "$role._id",
        },
      },
      {
        $unwind: {
          path: "$role",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $unwind: {
          path: "$role",
        },
      },
      {
        $addFields: {
          homeMenu: {
            $ifNull: ["$role.homeMenu._id", []],
          },
        },
      },
      {
        $addFields: {
          homeMenu: {
            $map: {
              input: "$homeMenu",
              in: { $toObjectId: "$$this" },
            },
          },
        },
      },
      {
        $lookup: {
          from: "pages",
          let: {
            menus: "$homeMenu",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$menus"],
                },
              },
            },
          ],
          as: "homeMenu",
        },
      },
      {
        $project: {
          homeMenu: 1,
        },
      },
    ],
    (err, data) => {
      if (err) {
        next(err);
      } else {
        console.log("data", data);
        if (data.length > 0) {
          res.json(data[0]);
        } else {
          res.status(403).json({ success: false, message: "No data menu" });
        }
      }
    }
  );
};

exports.addRole = function (req, res, next) {
  var new_data = new roleModel(req.body);
  console.log("body", req.body);
  new_data.save(function (err, result) {
    if (err) next(err);
    else
      res.json({
        status: "success",
        message: "Role added successfully!!!",
        data: result,
      });
  });
};

exports.updateRole = function (req, res, next) {
  const { name, description } = req.body;
  roleModel.findOneAndUpdate(
    { _id: req.params._id },
    { $set: { name, description } },
    { new: true },
    (err, data) => {
      if (err) {
        next(err);
      } else {
        res.status(200).json({ status: "success", message: "Role updated" });
      }
    }
  );
};

exports.updateHomeMenu = function (req, res, next) {
  const { homeMenu } = req.body;
  roleModel.findOneAndUpdate(
    { _id: req.params._id },
    { $set: { homeMenu } },
    { new: true },
    (err, data) => {
      if (err) {
        next(err);
      } else {
        res.status(200).json({ status: "success", message: "Role updated" });
      }
    }
  );
};

exports.changeMenu = function (req, res, next) {
  const { sidebarMenu, scope, departement, role_id } = req.body;
  roleModel.findOneAndUpdate(
    { _id: req.params._id },
    { $set: { sidebarMenu, scope, departement, role_id } },
    { new: true },
    async (err, data) => {
      if (err) {
        next(err);
      } else {
        try {
          await userModel.updateMany(
            { role: { $elemMatch: { _id: req.params._id } } },
            { $set: { "role.$": data } }
          );
          res.status(200).json({ status: "success", message: "Role updated" });
        } catch (errupdate) {
          next(errupdate);
        }
        // await userModel.findOneAndUpdate(
        //   { "role.name": data.name },
        //   { $set: { "role.$.permissions": permissions } },
        //   { new: true }
        // );
        // console.log("success");
      }
    }
  );
};

exports.deleteRole = function (req, res, next) {
  roleModel.findOneAndDelete({ _id: req.params._id }, async (err, data) => {
    if (err) {
      next(err);
    } else {
      await userModel.findOneAndUpdate(
        { "role.name": data.name },
        { $pull: { role: { name: data.name } } }
      );
      res.status(200).json({
        status: "success",
        message: "success deleted role",
        data,
      });
    }
  });
};
