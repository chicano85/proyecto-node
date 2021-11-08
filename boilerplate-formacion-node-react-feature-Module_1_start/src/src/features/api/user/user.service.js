// eslint-disable-next-line no-unused-vars
const { User, UserGroup } = require('../../../models');
const jwt = require('../../../utils/middleware/jwt');
const logger = require('../../../config/winston');
const sendinblue = require('../../../utils/lib/email');

const toPublic = (user) => user.toJSON();

const getUserRole = async (user) => UserGroup.findOne({ where: { uuid: user.role_uuid } });

// eslint-disable-next-line no-unused-vars
const isAdmin = async (user) => {
  const group = await getUserRole(user);
  const userRights = group.permissions.split('.');

  return userRights.includes('SUPERADMIN');
};

const isUserAuthorized = async (user, role) => {
  console.log(`user: ${JSON.stringify(user)}`);
  const group = await getUserRole(user);

  const userRights = group.permissions.split(',');
  const [roleResource] = role.split(':');

  return (
    userRights.includes('SUPERADMIN') ||
    userRights.includes(`${roleResource}:all`) ||
    userRights.includes(role)
  );
};

const activate = async (token, data) => {
  const payload = jwt.verifyJWT(token);
  const user = await User.findOne({ where: { uuid: payload.uuid } });
  return user.update(data);
};

const forgotPassword = async (user) => {
  const token = jwt.generateJWT({
    uuid: user.uuid,
    type: 'user',
  });

  try {
    await sendinblue.sendForgotPassword(user, token);
  } catch (error) {
    logger.info(`${error}`);
  }

  return true;
};

const recoveryPassword = async (token, data) => {
  // TODO: Send email with token for recovery pass
  const payload = jwt.verifyJWT(token);
  const user = await User.findOne({ where: { uuid: payload.uuid } });
  return user.update(data);
};

const getUsers = async (filters, options) => User.findAll({ where: filters, order: options.order });

const getUserByEmail = async (email) => User.findOne({ where: { email } });

const getUser = async (uuid) => {
  console.log(uuid);
  return User.findOne({ where: { uuid } });
};

const createUser = async (data) => {
  const dataToCreate = { ...data, token: '' };
  const user = await User.create(dataToCreate);
  return user.save();
};

const putUser = async (uuid, data) => {
  const user = await getUser(uuid);
  return user.update(data);
};

const deleteUser = async (user) => user.destroy();

module.exports = {
  toPublic,
  getUserRole,
  isUserAuthorized,
  activate,
  forgotPassword,
  recoveryPassword,
  getUsers,
  getUserByEmail,
  createUser,
  getUser,
  putUser,
  deleteUser,
  isAdmin,
};
