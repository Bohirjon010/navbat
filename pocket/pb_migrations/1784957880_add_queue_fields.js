/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("queues");

  collection.fields.add(
    new TextField({ name: "firstName", required: true, max: 120 }),
    new TextField({ name: "lastName", required: true, max: 120 }),
    new TextField({ name: "phone", required: true, max: 40 }),
    new TextField({
      name: "secretCode",
      required: true,
      min: 4,
      max: 4,
      pattern: "^\\d{4}$",
    }),
    new TextField({ name: "location", required: true, max: 180 }),
    new TextField({ name: "mapLocation", required: false, max: 500 }),
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
    new TextField({ name: "note", required: false, max: 2000 }),
    new TextField({
      name: "status",
      required: true,
      max: 20,
      pattern: "^(active|done|cancelled)$",
    }),
    new TextField({ name: "cancelReason", required: false, max: 2000 }),
    new TextField({ name: "cancelledAt", required: false, max: 40 }),
    new TextField({ name: "createdAt", required: true, max: 40 }),
  );

  collection.addIndex("idx_queues_status", false, "status", "");
  collection.addIndex("idx_queues_secretCode", false, "secretCode", "");
  collection.addIndex("idx_queues_createdAt", false, "createdAt", "");

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("queues");

  [
    "firstName",
    "lastName",
    "phone",
    "secretCode",
    "location",
    "mapLocation",
    "date",
    "time",
    "note",
    "status",
    "cancelReason",
    "cancelledAt",
    "createdAt",
  ].forEach((fieldName) => collection.fields.removeByName(fieldName));

  collection.removeIndex("idx_queues_status");
  collection.removeIndex("idx_queues_secretCode");
  collection.removeIndex("idx_queues_createdAt");

  return app.save(collection);
});
