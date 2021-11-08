/* eslint linebreak-style: ["error", "windows"] */

const { UserBilling } = require('../../../models');

const toPublic = (userBilling) => userBilling.toJSON();

const getUserBilling = async (uuid) =>
  UserBilling.findOne({
    where: {
      uuid,
    },
  });

const createUserBilling = async (data) => {
  const userBilling = await UserBilling.create(data);
  return userBilling.save();
};

const putUserBilling = async (uuid, data) => {
  const userBilling = await getUserBilling(uuid);
  return userBilling.update(data);
};

module.export = {
  toPublic,
  getUserBilling,
  createUserBilling,
  putUserBilling,
};
