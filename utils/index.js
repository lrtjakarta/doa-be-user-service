require("dotenv").config();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const moment = require("moment-timezone");

const getSelectedRoleInAccessToken = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  const decodedToken = jwt.decode(token);
  const { role } = decodedToken;

  return role;
};

const customMoment = (date = new Date()) => {
  return moment.tz(date, process.env.TIMEZONE);
};

const checkPermissions = (permissions, action) => {
  let newarray = action.split(",");
  let filter = newarray?.filter((x) => permissions.includes(x));
  // const check = permissions.includes(action)
  const check = filter.length > 0;
  return check;
};

// middleware untuk cek permission untuk suatu aksi
const authorization = (action) => {
  return (req, res, next) => {
    // next()
    const token = req.headers.authorization.replace(/^Bearer\s+/, "");
    // console.log("token", token);
    // const user = jwt.verify(token, req.app.get("secretKey"));
    const user = jwt.decode(token);
    // console.log("user", user);
    if (user == null) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You do not have permission params access token",
      });
    }
    const { permissions } = user;
    console.log("permissions", permissions);
    const isAllowed = checkPermissions(permissions, action);
    console.log(isAllowed);
    if (isAllowed) {
      req.userInfo = user;
      next();
    } else {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You do not have the necessary permissions to perform this action.",
      });
    }
  };
};

const validateAccessLevel = (role, roleTarget) => {
  // const access = ["province", "region", "district", "village"];
  const accessLevel = role.accessLevel;
  const accesLevelTarget = roleTarget.accessLevel;

  let validate = false;

  // return true if level access is lower than level access target
  if (accessLevel < accesLevelTarget) validate = true;

  // validate each level Level
  // for (let i = 0; i < accessLevel; i++) {
  //   const area = access[i];
  //   const areaCode = role[area]?.kode;

  //   if (Array.isArray(roleTarget)) {
  //     validate = areaCode === roleTarget[i]; // validating area by data query
  //   } else {
  //     validate = areaCode === roleTarget[area]?.kode; // validating area by data role user
  //   }

  //   if (!validate) return;
  // }

  return validate;
};

const validateUser = (id) => async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  const idParams = req.params[id] || req.query[id];
  const user = jwt.decode(token);

  const { role, id: _id } = user;

  // validate params user id
  if (idParams) {
    const roleAccess = role.accessLevel;

    if (!roleAccess && idParams === _id) {
      return next();
    } else {
      const _roleTarget = await axios.get(
        `${process.env.USER_URI}/auth/role/${idParams}`
      );
      const roleTarget = _roleTarget.data;

      // check if have same area code
      if (validateAccessLevel(role, roleTarget)) return next();
    }

    return res.status(401).json("You dont have an access for this user");
  }

  next();
};

// middleware untuk memverifikasi access token
const authentication = async (req, res, next, uriAuth) => {
  const token = req.headers.authorization.replace(/^Bearer\s+/, "");
  console.log("token", token);
  try {
    const resAuth = await axios.post(
      uriAuth,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (resAuth.status == 200) {
      next();
    } else {
      res.status(resAuth.status).json({ message: resAuth.status.message });
    }
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = {
  moment: customMoment,
  getSelectedRoleInAccessToken,
  validateUser,
  authorization,
  authentication,
};
