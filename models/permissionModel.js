const mongoose = require("mongoose");
//Define a schema
const Schema = mongoose.Schema;
const permissionSchema = new Schema(
  {
    type: String, // Button, Page, etc.
    name: String,
    code: String, // code access
    accessList: [Schema.Types.ObjectId], // list role that has permission to access
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("permissions", permissionSchema);
