/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("queues");

  collection.listRule = 'id != ""';
  collection.viewRule = 'id != ""';
  collection.createRule = '@request.body.firstName != ""';
  collection.updateRule = 'id != ""';
  collection.deleteRule = 'id != ""';

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("queues");

  collection.listRule = null;
  collection.viewRule = null;
  collection.createRule = null;
  collection.updateRule = null;
  collection.deleteRule = null;

  return app.save(collection);
});
