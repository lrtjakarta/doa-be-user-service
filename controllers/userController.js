const userModel = require("../models/userModel");
const userChangeLogModel = require("../models/userChangeLogModel");
const roleModel = require("./../models/roleModel");
const pageModel = require("./../models/pageModel");
const crypto = require("crypto");
const saltRounds = 10;
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { moment, getSelectedRoleInAccessToken } = require("../utils"); // custom moment;

const axios = require("axios");
require("dotenv").config();
const bcrypt = require("bcryptjs");
// const profileModel = require("../models/profileModel");

const listDepartement = {
  "662773cd84d37c2a2f2431f1": "Departemen Awak Sarana Perkeretaapian (ASP)",
  "662773fa84d37c2a2f2431f4": "Departemen Pengendali Operasi (POP)",
  "6627740c84d37c2a2f2431f7": "Departemen Pelayanan",
};

async function createNestedData(docs = []) {
  // Helper function to flatten document IDs
  const collectIds = (docs) => {
    let ids = [];
    for (const doc of docs) {
      ids.push(doc._id);
      if (doc.children) {
        ids = ids.concat(collectIds(doc.children));
      }
    }
    return ids;
  };

  // Collect all document IDs
  const ids = collectIds(docs);

  // Fetch all documents in one batch
  const dataMap = await pageModel
    .find({ _id: { $in: ids } })
    .lean()
    .then((docs) => {
      return docs.reduce((map, doc) => {
        map[doc._id] = doc;
        return map;
      }, {});
    });

  // Helper function to recursively build nested data
  const buildNestedData = (docs) => {
    return docs
      .map((doc) => {
        const data = dataMap[doc._id];
        if (!data) return null; // Skip if no corresponding data found

        let children = [];
        if (doc.children) {
          children = buildNestedData(doc.children);
        }
        return { ...data, ...(children.length ? { children } : {}) };
      })
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);
  };

  return buildNestedData(docs);
}

async function resetPasswordAMS(user_id, password, token) {
  const body = {
    user_id,
    password,
  };

  try {
    const reset_ams = await axios.post(
      `${process.env.OPERATIONAL_OCC_URI}/api/auth/user/editPassword`,
      body,
      { headers: { token } }
    );
    console.log("success reset ams password", reset_ams.data);
  } catch (error) {
    console.log("error reset ams password", error);
  }
}

const getRoleIdAMS = (role) => {
  const amsRoles = ["admin", "supervisor", "dispatcher"];

  const hasRole = Array.isArray(role) && role.length > 0;

  if (!hasRole) return null;

  const role_id = role[0].role_id;

  if (role_id) return role_id;

  const roleName = role[0].name.toLowerCase();
  const roleAMS = amsRoles.findIndex((r) => r === roleName);

  if (roleAMS === -1) return null;

  return roleAMS.toString();
};

async function updateUserAMS(result, dataProfile, token) {
  let user_id_return = null;
  try {
    let role_id = getRoleIdAMS(result.role);

    const user_id = result.user_id;
    const body = {
      user_id,
      username: result.username,
      name: dataProfile?.name,
      phone: dataProfile?.phone,
      email: dataProfile?.email,
      NIK: dataProfile?.idNumber,
      finger_id: dataProfile?.fingerID,
      tempat_lahir: dataProfile?.birth?.place,
      jenis_kelamin: dataProfile.gender === "Laki-laki" ? "L" : "P",
      tanggal_lahir: dataProfile.birth?.date
        ? moment(dataProfile.birth?.date).format("YYYY-MM-DD")
        : null,
      alamat: dataProfile.address,
      jabatan_id: dataProfile.jobPosition.jabatan_id,
      role_id: role_id,
    };

    const res_edit = await axios.post(
      `${process.env.OPERATIONAL_OCC_URI}/api/auth/user/edituserProfile`,
      body,
      { headers: { token } }
    );

    let data = res_edit.data;
    console.log("result", data);
    if (data.data) {
      if (!user_id) {
        user_id_return = data.data._id;
      }

      if (!dataProfile.user_id) {
        // update user_id in profile
        const bodyProfile = { user_id };
        await axios.put(
          `${process.env.WORKORDER_SERVICE_URI}/profile/${result.profileId}`,
          bodyProfile
        );
      }
    }

    return user_id_return;
  } catch (error) {
    console.log("error update user ams ", error);
  }
}

const registerUserAMS = async (data, passwordHashed, token) => {
  const body = {
    name: data.name,
    username: data.username,
    password: passwordHashed,
    role_id: data.role[0]?.role_id,
    has_jadwal: false,
    bypass: {
      finger_print: true,
      check_medic: true,
      jadwal_start_dinas: true,
    },
    status_id: "1", //data?.status === "0" || data?.status == 0 ? "2" : "1",
  };

  try {
    const res_req_ams = await axios.post(
      `${process.env.OPERATIONAL_OCC_URI}/api/auth/user/register`,
      body,
      { headers: { token } }
    );

    console.log("success post user ams", res_req_ams.data);
    const { data: _data, message } = res_req_ams.data;
    let user_id = _data.insertedId;
    if (message === "username sudah ada") {
      await axios.post(
        `${process.env.OPERATIONAL_OCC_URI}/api/auth/user/editPassword`,
        {
          user_id: _data._id,
          password: body.password,
        },
        { headers: { token } }
      );
      user_id = _data._id;
    }
    return user_id;
  } catch (error) {
    console.log("error register user ams", error);
    return null;
  }
};

exports.get_data = async function (req, res, next) {
  const {
    _id,
    userId,
    role,
    name,
    status,
    departement,
    division,
    isLimit,
    fetchProfile = "true",
  } = req.query;
  let query = {};

  // query pagination
  const page = parseInt(req.query.pageIndex) || 1;
  let pageSize = parseInt(req.query.pageSize) || 20;

  if (_id) {
    if (Array.isArray(_id)) {
      const objIds = _id.map((i) => mongoose.Types.ObjectId(i));

      query = { ...query, _id: { $in: objIds } };
    }
    if (typeof _id === "string") {
      query = { ...query, _id: mongoose.Types.ObjectId(_id) };
    }
  }

  if (name) {
    query = {
      ...query,
      name: {
        $regex: name,
        $options: "i",
      },
    };
  }
  if (role) {
    query = { ...query, "role._id": { $in: [role] } };
  }
  if (status) {
    query = { ...query, status };
  }
  if (division) {
    query = { ...query, division };
  }
  if (departement) {
    query = { ...query, departement };
  }
  if (userId) {
    query = {
      ...query,
      _id: userId,
    };
  }

  console.log("query", query);
  const totalItems = await userModel.countDocuments(query);
  const totalCount = Math.ceil(totalItems / pageSize);

  if (isLimit === "false") {
    pageSize = totalItems;
  }

  userModel
    .find(query, async (err, data) => {
      if (err) {
        next(err);
      } else {
        let newData = data;

        if (fetchProfile === "true") {
          newData = [];
          const profileIds = data
            .filter((doc) => doc.profileId)
            .map((doc) => doc.profileId.toString());
          let dataProfiles = await axios.get(
            `${process.env.WORKORDER_SERVICE_URI}/profile`,
            { params: { _id: profileIds, fetchUser: false } }
          );
          dataProfiles = dataProfiles.data.data;

          newData = data.map((item) => {
            const profileId = dataProfiles.find(
              (i) => i._id === item.profileId?.toString()
            );

            if (profileId) {
              return { ...item, profileId };
            }

            return item;
          });
        }

        res.json({ data: newData, totalItems, totalCount });
      }
    })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .sort({ _id: -1 })
    .lean()
    .projection({ password: 0, privateKey: 0, publicKey: 0, app: 0 });
};

exports.getUserbyID = function (req, res, next) {
  const { _id } = req.params;

  const roleId = getSelectedRoleInAccessToken(req);
  console.log("role id", roleId);
  userModel
    .findById(_id, async (err, data) => {
      if (err) {
        next(err);
      } else {
        const selectedRole = data.role?.find(
          (r) => r._id.toString() === roleId
        );

        let newData = { ...data, role: [selectedRole] };

        try {
          if (data.profileId) {
            const dataProfile = await axios.get(
              `${
                process.env.WORKORDER_SERVICE_URI
              }/profile/${data.profileId.toString()}`
            );
            // console.log("data profile", dataProfile.data);d

            // set data profile id
            newData = { ...newData, jobRole: dataProfile.data.jobPosition._id };
          }
        } catch (error) {
          console.log("error fetching data profile", error);
        }

        console.log("has jobrole", newData.hasOwnProperty("jobRole"));
        res.json(newData);
      }
    })
    .lean()
    .projection({ password: 0, privateKey: 0, publicKey: 0, app: 0 });
};

exports.getMenuByUserId = async function (req, res, next) {
  const { _id } = req.params;

  const selectedRoleId = getSelectedRoleInAccessToken(req);

  userModel.findById(_id, async (err, data) => {
    if (err) {
      next(err);
    } else {
      if (!data) {
        return res
          .status(404)
          .json({ success: false, message: "Menu Not Found" });
      }

      const role = data?.role;
      let idRole = role?.find((r) => r._id.toString() === selectedRoleId);

      try {
        const dataRole = await roleModel
          .findById(idRole, { sidebarMenu: 1 })
          .lean();

        const sidebarMenu = dataRole.sidebarMenu;

        const nestedData = await createNestedData(sidebarMenu);

        res.json(nestedData || []);
      } catch (error) {
        next(err);
      }
    }
  });
};

exports.getUserasFilter = function (req, res, next) {
  const { userId, role, name, status, userType } = req.query;
  let query = {};

  const pipeline = [
    {
      $match: query,
    },
    {
      $project: {
        name: 1,
        "role.name": 1,
        _id: 1,
        "role.scope": 1,
      },
    },
  ];

  userModel
    .aggregate(pipeline, (err, data) => {
      if (err) {
        next(err);
      } else {
        res.json(data);
      }
    })
    .sort({ _id: -1 });
  // .projection({ password: 0, name: 1, _id: 1 })
};

exports.register = function (req, res, next) {
  const secretKey = req.app.get("secretKey");

  /// generate privateKey & publicKey
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: secretKey,
    },
  });

  const new_data = new userModel({
    ...req.body,
    privateKey,
    publicKey,
    status: 0,
  });
  // console.log(new_data)

  new_data.save(async function (err, result) {
    if (err) next(err);
    else
      await userChangeLogModel.insertMany({
        userId: result._id,
        changeType: "insert",
        changeNote: "Add User",
        beforeData: {},
        afterData: result,
      });

    //Insert to ams
    const dept = req.body?.departement;
    if (listDepartement[dept] === "Departemen Pengendali Operasi (POP)") {
      const token = req.headers["token-ams"];
      const user_id = await registerUserAMS(req.body, result.password, token);
      if (user_id) {
        try {
          await userModel.findByIdAndUpdate(result._id, { $set: { user_id } });
        } catch (error) {
          console.log("error update user_id", error);
        }
      }
    }

    res.json({
      status: "success",
      message: "User added successfully!!!",
      // data: result,
    });
  });
};

exports.createUser = async function (req, res, next) {
  const secretKey = req.app.get("secretKey");
  const roleUser = await roleModel.findOne({ name: "User" }).lean();
  const _roleUser = [
    {
      ...roleUser,
    },
  ];
  // console.log("roleUser", _roleUser)

  // generate privateKey & publicKey
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: secretKey,
    },
  });

  const dataPost = {
    ...req.body,
    role: _roleUser,
    privateKey,
    publicKey,
    status: 0,
  };

  const new_data = new userModel(dataPost);
  new_data.save(async function (err, result) {
    if (err) next(err);
    else
      await userChangeLogModel.insertMany({
        userId: result._id,
        changeType: "insert",
        changeNote: "Add User",
        beforeData: {},
        afterData: result,
      });

    // kirim email aktivasi dan wa aktivasi
    // await axios.post(process.env.NOTIF_URL + "/mail/activation", {
    //   name: req.body.name,
    //   username: req.body.username,
    //   userId: req.body.userId,
    // });

    // Update Data Profile
    // await profileModel.findOneAndUpdate(
    //   { _id: req.body.id },
    //   { $set: { userId: result._id } }
    // );

    res.json({
      status: "success",
      message: "User created successfully!!!",
      // data: result,
    });
  });
};

exports.updateProfileId = function (req, res, next) {
  const { from } = req.query;
  const { _id } = req.params;
  const { profileId, dataProfile } = req.body;

  userModel.findByIdAndUpdate(
    _id,
    { $set: { profileId: mongoose.Types.ObjectId(profileId) } },
    async (err, result) => {
      if (err) {
        next(err);
      } else {
        // update user ams
        if (
          dataProfile.departement.name === "Departemen Pengendali Operasi (POP)"
        ) {
          const token = req.headers["token"];
          const user_id = await updateUserAMS(result, dataProfile, token);
          if (user_id) {
            await userModel.updateOne(
              { _id: result._id },
              { $set: { user_id } }
            );
            console.log("add user id ams");
          }
        }

        // update userId to profile
        if (from === "user-page") {
          const data = {
            userId: _id,
            ...(result.user_id && { user_id: result.user_id }),
          };
          try {
            await axios.put(
              `${process.env.WORKORDER_SERVICE_URI}/profile/${profileId}/user`,
              data
            );
          } catch (err) {
            console.log("error update userId in work order service");
          }
        }

        res.status(200).send("Berhasil menambah user");
      }
    }
  );
};

exports.changePassword = async function (req, res, next) {
  const { username, password, newPassword } = req.body;

  userModel.findOne({ username }, async function (err, userInfo) {
    // console.log("userInfo", userInfo)
    if (err) {
      res.status(403).json({ status: "error", message: "Invalid Data" });
    } else {
      if (userInfo) {
        if (bcrypt.compareSync(password, userInfo.password)) {
          userModel.findOneAndUpdate(
            { _id: userInfo._id },
            { $set: { password: bcrypt.hashSync(newPassword, saltRounds) } },
            { new: true },
            async (err, data) => {
              if (err) {
                next(err);
              } else {
                await userChangeLogModel.insertMany({
                  userId: userInfo._id,
                  changeType: "change",
                  changeNote: "change Password",
                  beforeData: userInfo,
                  afterData: data,
                });

                res
                  .status(200)
                  .json({ status: "success", message: "Change Password User" });
              }
            }
          );
        } else {
          res
            .status("403")
            .json({ status: "error", message: "Invalid Password" });
        }
      } else {
        res
          .status("403")
          .json({ status: "error", message: "Invalid Username" });
      }
    }
  });
};

exports.resetPassword = async function (req, res, next) {
  const { _id } = req.query;
  const { newPassword } = req.body;

  userModel.findById(_id, async function (err, userInfo) {
    // console.log("userInfo", userInfo)
    if (err) {
      res.status(403).json({ status: "error", message: "Invalid Data" });
    } else {
      if (userInfo) {
        const _newPassword = bcrypt.hashSync(newPassword, saltRounds);
        userModel.findOneAndUpdate(
          { _id: userInfo._id },
          { $set: { password: _newPassword } },
          { new: true },
          async (err, data) => {
            if (err) {
              next(err);
            } else {
              await userChangeLogModel.insertMany({
                userId: userInfo._id,
                changeType: "change",
                changeNote: "change Password",
                beforeData: userInfo,
                afterData: data,
              });

              // also reset password to user ams
              const tokenAms = req.headers["token-ams"];
              await resetPasswordAMS(data.user_id, _newPassword, tokenAms);

              res
                .status(200)
                .json({ status: "success", message: "Reset Password User" });
            }
          }
        );
      } else {
        res
          .status("403")
          .json({ status: "error", message: "Invalid Username" });
      }
    }
  });
};

exports.updateUser = async function (req, res, next) {
  const beforeData = await userModel.findOne({ _id: req.params._id });
  userModel.findOneAndUpdate(
    { _id: req.params._id },
    { $set: req.body },
    { new: true },
    async (err, data) => {
      if (err) {
        next(err);
      } else {
        // const afterData = await userModel.findOne({ _id: req.params._id })
        await userChangeLogModel.insertMany({
          userId: req.params._id,
          changeType: "change",
          changeNote: "change Profile",
          beforeData,
          afterData: data,
        });
        res.status(200).json({ status: "success", message: "User updated" });
      }
    }
  );
};

exports.activateUser = async function (req, res, next) {
  const { userId, status } = req.body;

  const beforeData = await userModel.findOne({ _id: userId });
  userModel.findOneAndUpdate(
    { _id: userId },
    { $set: { status } },
    { new: true },
    async (err, data) => {
      if (err) {
        next(err);
      } else {
        await userChangeLogModel.insertMany({
          userId,
          changeType: "change",
          changeNote: "Activate Profile",
          beforeData,
          afterData: data,
        });
        res.status(200).json({ status: "success", message: "User updated" });
      }
    }
  );
};

exports.deleteUser = async function (req, res, next) {
  const beforeData = await userModel.findOne({ _id: req.params._id });
  userModel.findOneAndDelete({ _id: req.params._id }, async (err, data) => {
    if (err) {
      next(err);
    } else {
      await userChangeLogModel.insertMany({
        userId: req.params._id,
        changeType: "delete",
        changeNote: "delete User",
        beforeData,
        afterData: {},
      });
      res.status(200).json({
        status: "success",
        message: "success deleted role",
        data,
      });
    }
  });
};

exports.getFCMs = function (req, res, next) {
  const { userid, roles } = req.body;
  let query = {};

  // console.log(userid)

  if (userid) {
    let fuserid = userid?.map((x) => mongoose.Types.ObjectId(x));
    query = {
      ...query,
      _id: { $in: fuserid },
    };
  }

  if (roles) {
    query = {
      ...query,
      "role.name": { $in: roles },
    };
  }

  userModel.aggregate(
    [{ $match: query }, { $project: { _id: 1, fcmtoken: 1, "role.name": 1 } }],
    (err, data) => {
      if (err) {
        next(err);
      } else {
        res.json(data);
      }
    }
  );
  // .sort({ _id: -1 })
  // .projection({ password: 0 })
};

exports.syncDataFromAMS = async function (req, res, next) {
  const secretKey = req.app.get("secretKey");
  const {
    user_id,
    name,
    username,
    idNumber,
    email,
    birth,
    gender,
    order,
    address,
    fingerID,
    phone,
    jobPosition,
    password,
    role,
    division,
    departement,
    isUser,
  } = req.body;

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: secretKey,
    },
  });
  const post_user = {
    name,
    username,
    password,
    role,
    division,
    departement,
    status: 1,
    privateKey,
    publicKey,
    user_id,
  };

  /// generate privateKey & publicKey
  var data_user = {};
  if (isUser) {
    const res_user = await userModel.findOne({ user_id });
    data_user = res_user;
  } else {
    const new_data = new userModel(post_user);
    new_data.skipHooks = true;
    const res_user = await new_data.save();
    // const res_user = await userModel.create();
    data_user = res_user;
  }

  console.log("res_user", post_user, data_user);
  const post_profile = {
    name,
    nickname: name,
    userId: data_user._id, // response dari register user
    idNumber,
    birth,
    gender,
    order,
    email,
    certificate: "",
    address,
    // "picture" : null,
    fingerID,
    phone,
    division,
    departement,
    jobPosition,
    supervisor: null,
    user_id,
  };

  const res_profile = await axios.post(
    `${process.env.WORKORDER_SERVICE_URI}/profile`,
    post_profile
  );
  console.log("res", res_profile.data);
  try {
    if (res_profile.data) {
      res.json({ msg: "success", data: res_profile.data });
    } else {
      res.json({ msg: "failed", data: {} });
    }
  } catch (err) {
    res.json({ msg: "failed", data: {} });
  }
};
