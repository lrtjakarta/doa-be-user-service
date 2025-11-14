const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const bcrypt = require("bcryptjs");
const userModel = require("./../models/userModel");
const roleModel = require("./../models/roleModel");
const userChangeLogModel = require("../models/userChangeLogModel");
const axios = require("axios");
const crypto = require("crypto");
const svgCaptcha = require("svg-captcha");
// const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

const SCOPES = [
  "https://mail.google.com/ https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.metadata https://www.googleapis.com/auth/drive.photos.readonly",
];

// Endpoint untuk mendapatkan CAPTCHA
exports.getcaptcha = (req, res, next) => {
  const captcha = svgCaptcha.create();
  req.session.captchaText = captcha.text;

  console.log("captcha", captcha.text);

  // save session captcha
  req.session.save(function (err) {
    if (err) return next(err);
  });
  res.json({
    image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString(
      "base64"
    )}`,
  });
};

const encryptData = (publicKey, data) => {
  const encryptedData = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(data)
  );

  return encryptedData;
};

const decryptData = (privateKey, secretKey, encrypted) => {
  const decryptedData = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
      passphrase: secretKey,
    },
    encrypted
  );

  return decryptedData;
};

const generateToken = (
  payload,
  privateKey,
  secretKey,
  options = { expiresIn: "3m", algorithm: "RS256" }
) => {
  const token = jwt.sign(
    payload,
    { key: privateKey.replace(/\\n/gm, "\n"), passphrase: secretKey },
    { ...options }
  );
  return token;
};

const generateAccessToken = async (id, name, role, privateKey, secretKey) => {
  const accessToken = jwt.sign(
    { id, name, role },
    // privateKey,
    { key: privateKey.replace(/\\n/gm, "\n"), passphrase: secretKey },
    {
      expiresIn: "14 days",
      algorithm: "RS256",
    }
  );
  const refreshToken = jwt.sign(
    { id, accessToken },
    // privateKey,
    { key: privateKey.replace(/\\n/gm, "\n"), passphrase: secretKey },
    {
      expiresIn: "30 days",
      algorithm: "RS256",
    }
  );
  return { accessToken, refreshToken };
};

const checkMultiRole = (roles) => {
  return roles.length > 1 ? true : false;
};

exports.check = async function (req, res, next) {
  axios
    .get(process.env.MEDICAL_URL + "/profile/searchbynik?nik=" + req.query.nik)
    .then((response) => {
      res.send(response.data);
    });
};

const generateUserInfoBySelectedRole = async (
  selectedRole,
  user,
  privateKey,
  secretKey
) => {
  const role = user.role.find((r) => r._id.toString() === selectedRole);
  const roleId = role._id;
  const roleName = role.name;
  const { accessToken, refreshToken } = await generateAccessToken(
    user._id,
    user.name,
    roleId,
    privateKey,
    secretKey
  );

  const newAccount = user.status === 0;
  // update user login info
  await userModel.findByIdAndUpdate(user._id, {
    $set: {
      signIn: new Date(),
      lastUpdate: new Date(),
      ...(newAccount && {
        status: 1,
      }),
    },
  });

  return {
    status: "success",
    message: "user found!!!",
    role: roleName,
    departement: user.departement,
    user: user.name,
    accessToken,
    refreshToken,
  };
};

const checkUserInfo = async function (userInfo, privateKey, secretKey) {
  const roles = userInfo.role.map((x) => ({
    ...x,
    permissions: [],
  }));
  const roleName = roles[0].name;
  const roleId = roles[0]._id.toString();

  const isNewAccount = userInfo.status === 0;

  const genToken = await generateAccessToken(
    userInfo._id,
    userInfo.name,
    roleId,
    privateKey,
    secretKey
  );

  await userModel.findByIdAndUpdate(
    { _id: userInfo._id },
    {
      ...(isNewAccount && {
        status: 1,
      }),
      signIn: new Date(),
      lastUpdate: new Date(),
    }
  );

  return {
    status: "success",
    message: "user found!!!",
    role: roleName,
    departement: userInfo.departement,
    user: userInfo.name,
    accessToken: genToken.accessToken,
    refreshToken: genToken.refreshToken,
  };
};

const loginAMS = async (username, password) => {
  const body = {
    username,
    password,
  };
  return await axios
    .post(`${process.env.OPERATIONAL_OCC_URI}/api/login`, body)
    .then((res) => {
      const { result, token } = res.data;

      if (result) {
        return token;
      }

      return null;
    })
    .catch((err) => {
      // console.log("Something's wrong with login AMS", err);
      return null;
    });
};

const registerUserAMS = async (data, passwordHashed, token) => {
  const body = {
    username: data.username,
    password: passwordHashed,
    role_id: data.role_id,
    status_id: data?.status || "1",
  };

  try {
    await axios.post(
      `${process.env.OPERATIONAL_OCC_URI}/api/auth/user/register`,
      body,
      { headers: token }
    );
  } catch (error) {
    console.log("error register user ams", error);
  }
};

exports.verifyMultiRole = async (req, res, next) => {
  const { token, role } = req.body;

  const decodedToken = jwt.decode(token);
  console.log("decoded token", decodedToken);
  const user = await userModel.findById(decodedToken.id).lean();
  if (!user) {
    console.log("user not found");
    return res.status(403).json({ success: false, message: "Invalid Token" });
  }

  // verify token
  const secretKey = req.app.get("secretKey");
  const publicKey = user.publicKey;
  const privateKey = user.privateKey;

  try {
    const verifyDecoded = jwt.verify(token, publicKey.replace(/\\n/gm, "\n"), {
      algorithms: "RS256",
    });

    // decrypt login info
    const encryptedData = Buffer.from(verifyDecoded.data, "base64");
    const decryptedData = decryptData(privateKey, secretKey, encryptedData);
    const decryptedObject = JSON.parse(decryptedData);

    // return login results
    let result = await generateUserInfoBySelectedRole(
      role,
      user,
      privateKey,
      secretKey
    );

    const { username, password } = decryptedObject;
    const amsToken = await loginAMS(username, password);
    if (amsToken) {
      result = { ...result, amsToken };
    }

    res.json(result);
  } catch (error) {
    console.log("error verify token", error);
    return res.status(401).json({ success: false, message: "Unauthorized!" });
  }
};

exports.login = function (req, res, next) {
  const { username, email, password, answer, app, token } = req.body;

  let userid = "";

  if (email) {
    userid = email;
  }
  if (username) {
    userid = username;
  }

  // check captcha
  // console.log("answer", answer);
  // console.log("captcha", req.session.captchaText);
  if (!answer || !req.session.captchaText) {
    console.log("Jawaban CAPTCHA diperlukan");
    res
      .status(403)
      .json({ status: "error", message: "Jawaban CAPTCHA diperlukan" });
    return;
  }

  if (answer === req.session.captchaText) {
    userModel
      .findOne(
        {
          $or: [{ username: userid }],
          // "roles.name":{$in:access}
        },
        async function (err, userInfo) {
          if (err) {
            res.status(403).send("Invalid username or password");
          } else {
            if (userInfo) {
              if (bcrypt.compareSync(password, userInfo.password)) {
                const secretKey = req.app.get("secretKey");
                const privateKey = userInfo.privateKey;

                const multiRole = checkMultiRole(userInfo.role);
                if (multiRole) {
                  // encrypt login info
                  const publicKey = userInfo.publicKey;

                  const loginInfo = { username, password };
                  const dataStringLoginInfo = JSON.stringify(loginInfo);
                  const encryptedData = encryptData(
                    publicKey,
                    dataStringLoginInfo
                  );

                  const roles = userInfo.role?.map((r) => ({
                    _id: r._id,
                    name: r.name,
                  }));

                  // generate token for multirole
                  const payload = {
                    id: userInfo._id,
                    data: encryptedData.toString("base64"), // convert to string base64
                  };
                  const multiRoleToken = generateToken(
                    payload,
                    privateKey,
                    secretKey
                  );

                  return res.json({
                    success: true,
                    message: "Choose role access!",
                    data: { token: multiRoleToken, roles, multi: true },
                  });
                }

                let result = await checkUserInfo(
                  userInfo,
                  privateKey,
                  secretKey
                );
                const amsToken = await loginAMS(username, password);

                if (amsToken) {
                  result = { ...result, amsToken };
                }

                res.json(result);
              } else {
                console.log("Invalid username");
                res.status("403").send("Invalid username or password");
              }
            } else {
              console.log("User not found");
              res.status("403").send("Invalid username or password");
            }
          }
        }
      )
      .lean();
  } else {
    return res
      .status(403)
      .json({ status: "error", message: "Jawaban CAPTCHA diperlukan" });
  }
};

exports.loginBypass = function (req, res, next) {
  const { username, email } = req.body;

  let userid = "";

  if (email) {
    userid = email;
  }
  if (username) {
    userid = username;
  }

  // check captcha
  // console.log("answer", answer);

  userModel
    .findOne(
      {
        $or: [{ username: userid }],
        // "roles.name":{$in:access}
      },
      async function (err, userInfo) {
        if (err) {
          res.status(403).send("Invalid username or password");
        } else {
          if (userInfo) {
            const secretKey = req.app.get("secretKey");
            const privateKey = userInfo.privateKey;

            const multiRole = checkMultiRole(userInfo.role);
            if (multiRole) {
              // encrypt login info
              const publicKey = userInfo.publicKey;

              const loginInfo = { username, password };
              const dataStringLoginInfo = JSON.stringify(loginInfo);
              const encryptedData = encryptData(publicKey, dataStringLoginInfo);

              const roles = userInfo.role?.map((r) => ({
                _id: r._id,
                name: r.name,
              }));

              // generate token for multirole
              const payload = {
                id: userInfo._id,
                data: encryptedData.toString("base64"), // convert to string base64
              };
              const multiRoleToken = generateToken(
                payload,
                privateKey,
                secretKey
              );

              return res.json({
                success: true,
                message: "Choose role access!",
                data: { token: multiRoleToken, roles, multi: true },
              });
            }

            let result = await checkUserInfo(userInfo, privateKey, secretKey);

            res.json(result);
          } else {
            console.log("User not found");
            res.status("403").send("Invalid username or password");
          }
        }
      }
    )
    .lean();
};

exports.loginPIN = function (req, res, next) {
  const { _id, pin } = req.body;
  // const secretKey = req.app.get("secretKey");
  userModel.findOne({ _id }, async function (err, userInfo) {
    if (err) {
      res.status(403).json({ status: "error", message: "Invalid Data" });
    } else {
      if (userInfo) {
        if (bcrypt.compareSync(pin, userInfo.pin)) {
          const genToken = jwt.sign({ _id, name: userInfo.name }, secretKey, {
            expiresIn: "5m",
          });
          await userModel.findByIdAndUpdate(
            { _id: userInfo._id },
            { lastUpdate: new Date() }
          );
          res.json({
            status: "success",
            message: "access page success",
            accessPage: genToken,
          });
        } else {
          res.status("403").json({ status: "error", message: "Invalid PIN" });
        }
      } else {
        res.status("403").json({ status: "error", message: "Invalid User" });
      }
    }
  });
};

exports.activation = async function (req, res, next) {
  const { id } = req.query;

  const getDataProfile = await axios.get(
    process.env.MEDICAL_URL + "/profile/activation?id=" + id
  );

  const dataPost = getDataProfile.data;

  const roleUser = await roleModel.findOne({ name: "User" });
  var new_data = new userModel({
    ...dataPost,
    role: [
      {
        ...roleUser,
        province: dataPost.province,
        region: dataPost.region,
        district: dataPost.district,
        village: dataPost.village,
      },
    ],
  });
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

    //Update Profile dari statusRegistration 0 menjadi 1

    await axios.put(process.env.MEDICAL_URL + "/profile/" + result._id, {
      statusRegistration: 1,
    });
    res.json({
      status: "success",
      message: "User added successfully!!!",
      data: result,
    });
  });
};

exports.checkUsername = async function (req, res, next) {
  userModel.findOne({ username: req.query.username }, (err, data) => {
    if (data) {
      res.send(true);
    } else {
      res.send(false);
    }
  });
};

exports.getRoleByUserId = function (req, res, next) {
  const { _id } = req.params;

  userModel.findOne({ _id }, { role: 1 }, (err, data) => {
    if (err) {
      next(err);
    } else {
      let role = data.role;
      // console.log("data", data);
      return res.json(role);
    }
  });
};

exports.register = async function (req, res, next) {
  const secretKey = req.app.get("secretKey");
  const roleUser = await roleModel.findOne({ name: "User" });

  // validating username
  const usernameCheck = await userModel.findOne({
    username: req.body.username,
  });
  if (usernameCheck) {
    res.json({
      status: "failed",
      message: "Email have been registered!!",
      data: {},
    });
  } else {
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

    var new_data = new userModel({
      ...req.body,
      role: [
        {
          ...roleUser,
        },
      ],
      privateKey,
      publicKey,
      status: 1,
    });

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

      const tokenAms = req.headers["token-ams"];
      await registerUserAMS(req.body, result.password, tokenAms);

      res.json({
        status: "success",
        message: "User added successfully!!!",
      });
    });
  }
};

exports.verifyToken = async function (req, res, next) {
  const token = req.headers.authorization.split(" ")[1];

  try {
    const decodedToken = jwt.decode(token);
    const user = await userModel.findOne({ _id: decodedToken.id }).lean();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const publicKey = user.publicKey;
    jwt.verify(token, publicKey.replace(/\\n/gm, "\n"), {
      algorithms: "RS256",
    });

    delete user.password;
    delete user.publicKey;
    delete user.privateKey;
    res.status(200).json({ user, message: "User verified" });
  } catch (err) {
    console.log(err);
    res.status(401).json({ message: "Invalid token" });
  }
};

exports.refreshToken = async function (req, res, next) {
  const { refreshToken } = req.body;

  const decodedRefreshToken = jwt.decode(refreshToken);

  const user = await userModel.findOne({ _id: decodedRefreshToken.id }).lean();
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  console.log("users", user);
  const secretKey = req.app.get("secretKey");
  const publicKey = user.publicKey;
  const privateKey = user.privateKey;

  jwt.verify(
    refreshToken,
    publicKey.replace(/\\n/gm, "\n"),
    {
      algorithms: "RS256",
    },
    async (err, decoded) => {
      if (err) {
        //   console.log("err");
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      const { accessToken } = decoded;
      // console.log("running", decoded);

      const decodedAccessToken = jwt.decode(accessToken);
      const { id, name, role, permissions } = decodedAccessToken;

      const genToken = await generateAccessToken(
        id,
        name,
        role,
        privateKey,
        secretKey
      );
      await userModel.findByIdAndUpdate({ _id: id }, { signIn: new Date() });
      return res.json({
        accessToken: genToken.accessToken,
        refreshToken: genToken.refreshToken,
      });
    }
  );
};
