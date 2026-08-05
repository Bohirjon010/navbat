/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    id: "pbc_queues01",
    name: "queues",
    type: "base",
    system: false,
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      new TextField({
        name: "firstName",
        required: true,
        max: 120,
      }),
      new TextField({
        name: "lastName",
        required: true,
        max: 120,
      }),
      new TextField({
        name: "phone",
        required: true,
        max: 40,
      }),
      new TextField({
        name: "secretCode",
        required: true,
        min: 4,
        max: 4,
        pattern: "^\\d{4}$",
      }),
      new TextField({
        name: "location",
        required: true,
        max: 180,
      }),
      new TextField({
        name: "date",
        required: true,
        max: 10,
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      }),
      new TextField({
        name: "time",
        required: true,
        max: 5,
        pattern: "^\\d{2}:\\d{2}$",
      }),
      new TextField({
        name: "note",
        required: false,
        max: 2000,
      }),
      new SelectField({
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["active", "done", "cancelled"],
      }),
      new TextField({
        name: "cancelReason",
        required: false,
        max: 2000,
      }),
      new TextField({
        name: "cancelledAt",
        required: false,
        max: 40,
      }),
      new TextField({
        name: "createdAt",
        required: true,
        max: 40,
      }),
    ],
    indexes: [
      "CREATE INDEX idx_queues_status ON queues (status)",
      "CREATE INDEX idx_queues_secretCode ON queues (secretCode)",
      "CREATE INDEX idx_queues_createdAt ON queues (createdAt)",
    ],
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("queues");

  return app.delete(collection);
});
