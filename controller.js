const Router = require('@koa/router');
const fs = require('fs');

function registerRoutes(router, controller) {
    for (const [path, mapping] of Object.entries(controller)) {
        // path should start with '/', otherwise it is not a path
        // this is to skip other possible exports
        // like variables or functions
        if (path.charAt(0) === '/')
            for (const [method, middleware] of Object.entries(mapping)) {
                router.register(path, [method], middleware);
                console.log(`${method} ${path} added`);
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