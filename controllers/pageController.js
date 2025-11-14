const pageModel = require("../models/pageModel");
const mongoose = require("mongoose");

// async function createNestedData(parentId = null) {
//   const query = parentId ? { parent: parentId } : { parent: null };
//   const docs = await pageModel.find(query).sort({ index: 1, _id: -1 }).lean();

//   const nestedData = [];
//   for (const doc of docs) {
//     const children = await createNestedData(doc._id);
//     const nestedDoc = { ...doc, ...(children.length > 0 && { children }) };
//     nestedData.push(nestedDoc);
//   }
//   return nestedData;
// }

async function createNestedData() {
  // Fetch all data from the database
  const docs = await pageModel.find().sort({ index: 1, _id: -1 }).lean();

  // Create a map to hold references to each document by its _id
  const docMap = new Map();
  docs.forEach((doc) =>
    docMap.set(doc._id.toString(), { ...doc, children: [] })
  );

  // Create the nested data structure
  const rootNodes = [];
  docs.forEach((doc) => {
    if (doc.parent) {
      const parent = docMap.get(doc.parent.toString());
      if (parent) {
        parent.children.push(docMap.get(doc._id.toString()));
      }
    } else {
      rootNodes.push(docMap.get(doc._id.toString()));
    }
  });

  return rootNodes;
}

exports.getPage = async function (req, res, next) {
  try {
    const nestedData = await createNestedData();

    console.log("data", nestedData);
    res.json({
      status: "success",
      data: nestedData,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSidebarMenu = async function (req, res, next) {
  try {
    const nestedData = await createNestedData();

    console.log("data", nestedData);
    res.json({
      status: "success",
      data: nestedData,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnstructured = function (req, res, next) {
  const { name, parent, type, level, hasLink } = req.query;
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
  if (hasLink === "true") {
    query = {
      ...query,
      link: {
        $regex: "app",
        $options: "i",
      },
    };
  }

  if (parent) {
    query = {
      ...query,
      parent: mongoose.Types.ObjectId(parent),
    };
  }

  if (type) {
    query = {
      ...query,
      type,
    };
  }
  if (level) {
    query = {
      ...query,
      level,
    };
  }

  console.log("query", query);

  pageModel.find(query, (err, data) => {
    if (err) {
      next(err);
    } else {
      res.json(data);
    }
  });
};

exports.addPage = function (req, res, next) {
  const { name, type, link, icon, level, parent, index } = req.body;

  const pageData = {
    link,
    icon,
    level,
    parent,
  };

  const new_data = new pageModel({
    name,
    type,
    index,
    ...(type === "page" && pageData),
  });

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

exports.updatePage = function (req, res, next) {
  const { parent } = req.body;
  const setParentNull = {
    parent: null,
  };

  console.log("body", req.body);
  pageModel.findOneAndUpdate(
    { _id: req.params._id },
    { $set: { ...req.body, ...(!parent && setParentNull) } },
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

exports.deletePage = function (req, res, next) {
  pageModel.findOneAndDelete({ _id: req.params._id }, async (err, data) => {
    if (err) {
      next(err);
    } else {
      res.status(200).json({
        status: "success",
        message: "success deleted Page",
        data,
      });
    }
  });
};
