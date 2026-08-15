/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    id: "pbc_adminlogs",
    name: "admin_logs",
    type: "base",
    system: false,
    listRule: '@request.auth.collectionName = "admins"',
    viewRule: '@request.auth.collectionName = "admins"',
    createRule: '@request.auth.collectionName = "admins"',
    updateRule: null,
    deleteRule: null,
    fields: [
      new TextField({
        name: "action",
        required: true,
        max: 80,
      }),
      new TextField({
        name: "adminId",
        required: true,
        max: 80,
      }),
      new EmailField({
        name: "adminEmail",
        required: true,
      }),
      new TextField({
        name: "queueId",
        required: false,
        max: 80,
      }),
      new TextField({
        name: "queueTitle",
        required: false,
        max: 240,
      }),
      new TextField({
        name: "note",
        required: false,
        max: 2000,
      }),
      new TextField({
        name: "createdAt",
        required: true,
        max: 40,
      }),
    ],
    indexes: [
      "CREATE INDEX idx_admin_logs_created ON admin_logs (created)",
      "CREATE INDEX idx_admin_logs_action ON admin_logs (action)",
    ],
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("admin_logs");

  return app.delete(collection);
});
