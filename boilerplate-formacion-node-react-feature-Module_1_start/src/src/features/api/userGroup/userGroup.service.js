const { models } = require('../../../models');

const toPublic = (userGroup) => userGroup.toJSON();

const getUserGroups = (filters, options) =>
  models.UserGroup.findAll({
    where: filters,
    order: options.order,
  });

const getUserGroup = async (uuid) =>
  models.UserGroup.findOne({
    where: {
      uuid,
    },
  });

const createUserGroup = async (data) => {
  const userGroup = models.UserGroup.create(data);
  return userGroup.save();
};

const putUserGroup = async (uuid, data) => {
  const userGroup = getUserGroup(uuid);
  return userGroup.update(data);
};

const deleteUserGroup = async (userGroup, userId) => {
  await userGroup.delete(userId);
};

module.exports = {
  toPublic,
  getUserGroups,
  getUserGroup,
  createUserGroup,
  putUserGroup,
  deleteUserGroup,
};
