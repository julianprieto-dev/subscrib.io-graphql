import { OAuth2Client } from "google-auth-library";

export const getUserData = async (token, db) => {
  let cleanToken;

  if (token.startsWith("Bearer ")) {
    cleanToken = token.substring(7, token.length);
  } else {
    return null;
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const client = new OAuth2Client(googleClientId);

  try {
    const ticket = await client.verifyIdToken({
      idToken: cleanToken,
      audience: googleClientId,
    });
    const user = ticket.getPayload();

    const [dbUser, _created] = await db.User.findOrCreate({
      where: { email: user.email },
      defaults: {
        email: user.email,
        name: user.name,
        givenName: user.given_name,
        familyName: user.family_name,
        picture: user.picture,
      },
    });

    return dbUser.toJSON();
  } catch (error) {
    return null;
  }
};

export const convertSubscriptionsToCurrency = async (subsFromDB, convertToCurrency, ctx) => {
  const currenciesFromSubscriptions = subsFromDB.map((s) => s.currency);
  const uniqueCurrenciesToQuery = Array.from(new Set([convertToCurrency, ...currenciesFromSubscriptions]));
  const currenciesFromDB = await ctx.db.Currency.findAll({
    where: { id: uniqueCurrenciesToQuery },
  });

  const currencies = currenciesFromDB
    .map((c) => c.toJSON())
    .reduce((prev, curr) => {
      return {
        ...prev,
        [curr.id]: curr.rate,
      };
    }, {});
  const subscriptions = subsFromDB.map((sub) => ({
    ...sub.toJSON(),
    currency: convertToCurrency,
    price: (
      (sub.price * parseFloat(currencies[convertToCurrency]).toFixed(2)) /
      parseFloat(currencies[sub.currency]).toFixed(2)
    ).toFixed(2),
  }));

  return subscriptions;
};
