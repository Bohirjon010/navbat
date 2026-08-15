/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    id: "pbc_admins01",
    name: "admins",
    type: "auth",
    system: false,
    listRule: '@request.auth.collectionName = "admins"',
    viewRule: '@request.auth.collectionName = "admins"',
    createRule: null,
    updateRule: '@request.auth.collectionName = "admins" && id = @request.auth.id',
    deleteRule: null,
    authRule: "",
    fields: [
      new TextField({
        name: "name",
        required: true,
        max: 120,
      }),
    ],
    indexes: [],
  });

  collection.passwordAuth.enabled = true;
  collection.passwordAuth.identityFields = ["email"];
  collection.authToken.duration = 60 * 60 * 8;

  app.save(collection);

  const admin = new Record(collection, {
    name: "Admin",
    email: "admin@gapnavbati.local",
    emailVisibility: false,
    verified: true,
  });
  admin.setPassword("admin123");

  return app.save(admin);
}, (app) => {
  const collection = app.findCollectionByNameOrId("admins");

  return app.delete(collection);
});
