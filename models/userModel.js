const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const saltRounds = 10;
//Define a schema
const Schema = mongoose.Schema;
const userSchema = new Schema(
  {
    name: String,
    username: { type: String, required: true, unique: true, trim: true },
    profileId: Schema.Types.ObjectId,
    user_id: String,
    division: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    departement: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    role: [
      {
        name: String,
        permissions: [String],
        departement: String,
        scope: String,
        role_id: String,
        accessLevel: {
          // use for validate id params
          type: Number,
          default: 0, // 0 = User, 1 = Admin
        },
        sub: [String],
      },
    ],
    password: String,
    signIn: Date,
    lastUpdate: Date,
    privateKey: {
      type: String,
      required: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    app: String,
    status: Number, //0 (new register) - 1 (verified - active) - 2 (suppend) - 3 (blocked)
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", function (next) {
  if (this.skipHooks) return next();

  if (this.password) {
    this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  if (this.pin) {
    this.pin = bcrypt.hashSync(this.pin, saltRounds);
  }
  next();
});

module.exports = mongoose.model("users", userSchema);
