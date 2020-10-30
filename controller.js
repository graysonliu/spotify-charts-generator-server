const Router = require('@koa/router');
const fs = require('fs');

function registerRoutes(router, controller) {
    for (const [path, mapping] of Object.entries(controller)) {
        for (const [method, middleware] of Object.entries(mapping)) {
            router.register(path, [method], middleware);
        }
    }
}

function addControllers(router, dir) {
    fs.readdirSync(__dirname + '/' + dir).filter((f) => {
        return f.endsWith('.js');
    }).forEach((f) => {
        console.log(`processing controller: ${f}...`);
        const controller = require(__dirname + '/' + dir + '/' + f);
        registerRoutes(router, controller);
    });
}

module.exports = function (dir) {
    const dir_controllers = dir || 'controllers';
    const router = Router();
    addControllers(router, dir_controllers);
    return router.routes();
};