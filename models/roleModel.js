const mongoose = require("mongoose");

//Define a schema
const Schema = mongoose.Schema;
const roleSchema = new Schema(
  {
    name: { type: String, required: true },
    role_id: String, // for ams app
    description: String,
    permissions: [String],
    division: String,
    departement: String,
    jobRole: String, // for multi role
    sidebarMenu: Array,
    homeMenu: Array,
    accessLevel: {
      // use for validate id params
      type: Number,
      default: 0, // 0 = User, 1 = Admin
    },
    // departement: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "departements",
    // },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("roles", roleSchema);
