const boom = require('@hapi/boom');
const { cloneDeep } = require('lodash');

const { UniqueConstraintError } = require('sequelize');

const userService = require('./user.service');
const activityService = require('../activity/activity.service');
const activityActions = require('./user.activity');
const queryOptions = require('../../../utils/queryOptions');
const userFilters = require('./user.filters');
const logger = require('../../../config/winston');

const activate = async (req, res) => {
  const { token } = req.params;

  try {
    if (token !== '') {
      await userService.activate(token, { active: true, token: '' });
    }
  } catch (error) {
    logger.error(`${error}`);
  }

  return res.json({
    status: 'OK',
  });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let user;

  try {
    user = await userService.getUserByEmail(email);
  } catch (error) {
    logger.error(`${error}`);
    return next(boom.unauthorized('Usuario no válido'));
  }

  if (!user) {
    return next(boom.unauthorized('El email y la contraseña introducidos no son válidos'));
  }

  try {
    const userHasValidPassword = await user.validPassword(password);

    if (!userHasValidPassword) {
      return next(boom.unauthorized('La contraseña es errónea'));
    }
  } catch (error) {
    logger.error(`${error}`);
    return next(boom.badRequest(error.message));
  }

  if (res.locals.condition && res.locals.condition.isAdmin === true) {
    const userIsAdmin = await userService.isAdmin(user);

    if (!userIsAdmin) {
      return next(boom.unauthorized('El user debe ser administrador'));
    }
  }

  let response;

  try {
    response = await user.toAuthJSON();
  } catch (error) {
    logger.error(`${error}`);
    return next(boom.badRequest(error.message));
  }

  return res.json(response);
};

const register = async (req, res, next) => {
  const userData = req.body;
  let user;
  try {
    user = await userService.createUser(userData);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return next(boom.badData('Ya existe un usuario con el email introducido'));
    }
    logger.error(`${error}`);
    return next(boom.badData(error.message));
  }

  try {
    await activityService.createActivity({
      action: activityActions.CREATE_USER,
      author: 'Anonymous',
      elementAfter: user.toJSON(),
    });
  } catch (error) {
    logger.error(`${error}`);
  }

  res.status(201).json(user.toJSON());
};

const forgot = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userService.getUserByEmail(email);

    if (user) {
      await userService.forgotPassword(user);
    }
  } catch (error) {
    logger.error(`${error}`);
  }

  return res.json({
    status: 'OK',
    msg: 'Si el email existe, se habrá mandado un email con instrucciones para restablecer su contraseña',
  });
};

const recovery = async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  try {
    if (password === confirmPassword) {
      await userService.recoveryPassword(token, { password });
    }
  } catch (error) {
    logger.error(`${error}`);
  }

  return res.json({
    status: 'OK',
  });
};

const listUsers = async (req, res, next) => {
  try {
    const filters = userFilters(req.query);
    const options = queryOptions(req.query);

    options.select = { password: false, _id: false };
    options.leanWithId = false;

    res.json(await userService.getUsers(filters, options));
  } catch (error) {
    logger.error(`${error}`);
    return next(boom.badImplementation(error.message));
  }
};

const createUser = async (req, res, next) => {
  const userData = req.body;
  let user;
  try {
    user = await userService.createUser(userData);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return next(boom.badData('Ya existe un usuario con el email introducido'));
    }
    logger.error(`${error}`);
    return next(boom.badData(error.message));
  }

  try {
    await activityService.createActivity({
      action: activityActions.CREATE_USER,
      author: req.user.email,
      elementBefore: JSON.stringify({}),
      elementAfter: JSON.stringify(user.toJSON()),
    });
  } catch (error) {
    logger.error(`${error}`);
  }

  res.status(201).json(userService.toPublic(user));
};

const getUser = async (req, res, next) => {
  try {
    if (res.locals && res.locals.user) {
      return res.json(await userService.toPublic(res.locals.user));
    }
    res.json(await userService.toPublic(req.user));
  } catch (error) {
    logger.error(`${error}`);
    return next(boom.badImplementation(error.message));
  }
};

const putUser = async (req, res, next) => {
  let { user } = req;
  if (res.locals && res.locals.user) {
    // eslint-disable-next-line prefer-destructuring
    user = res.locals.user;
  }

  const userData = req.body;
  let response;

  try {
    const userUuid = user.uuid;
    delete userData.uuid;
    response = await userService.putUser(userUuid, userData);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return next(boom.badData('Ya existe un usuario con el email introducido'));
    }
    logger.error(`${error}`);
    return next(boom.badData(error.message));
  }

  try {
    await activityService.createActivity({
      action: activityActions.UPDATE_USER,
      author: req.user.email,
      elementBefore: JSON.stringify(user.toJSON()),
      elementAfter: JSON.stringify(response.toJSON()),
    });
  } catch (error) {
    logger.error(`${error}`);
  }

  res.json(userService.toPublic(response));
};

const deleteUser = async (req, res, next) => {
  const { user } = res.locals;
  const userBeforeDelete = cloneDeep(user);

  try {
    await userService.deleteUser(user, req.user._id);
  } catch (error) {
    logger.error(`${error}`);
    return next(boom.badImplementation(error.message));
  }

  try {
    await activityService.createActivity({
      action: activityActions.DELETE_USER,
      author: req.user.toJSON(),
      elementBefore: userBeforeDelete.toJSON(),
    });
  } catch (error) {
    logger.error(`${error}`);
  }

  res.status(204).json({});
};

// eslint-disable-next-line no-unused-vars
const getUserBilling = async (req, res, next) => {
  try {
    if (res.locals && res.locals.user && res.locals.user.billing) {
      return res.json(userBillingService.toPublic(res.locals.user.billing));
    }
    return next(boom.notFound());
  } catch (error) {
    logger.error('$(error)');
    return next(boom.badImplementation(error.message));
  }
};

// eslint-disable-next-line no-unused-vars
const putUserBilling = async (req, res, next) => {
  let { user } = req;
  if (res.locals && res.locals.user) {
    user = res.locals.user;
  }

  if (!user) {
    return next(boom.notFound());
  }

  // eslint-disable-next-line no-unused-vars
  const userBilling = user.billing;

  // eslint-disable-next-line no-unused-vars
  const billingData = req.body;
  // eslint-disable-next-line no-unused-vars
  let response;
};

module.exports = {
  activate,
  login,
  register,
  forgot,
  recovery,
  listUsers,
  getUser,
  createUser,
  putUser,
  deleteUser,
  getUserBilling,
  putUserBilling,
};
