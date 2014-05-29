# fis-prepackager-autoload

用于自动加载模块化资源的[FIS](https://github.com/fex-team/fis)插件

## 功能

 - 将当前页面的所有资源依赖自动注入页面中，


## 功能特点

 - 无需手工维护 ```<script src="path"></script>``` 或 ```<link rel="stylesheet" href="path">``` 标签引用资源，页面依赖的资源会自动加载，实现**像写Node.js程序一样编写前端页面**。
 - 与[fis-postprocessor-require-async](https://github.com/xiangshouding/fis-postprocessor-require-async)插件结合，支持[modjs](https://github.com/fex-team/mod)的require.async异步加载功能
 - 使[modjs](https://github.com/fex-team/mod)脱离后端静态资源管理依赖，使用成本更低，配合[fis-postpackager-combine](https://github.com/hefangshi/fis-postpackager-combine)插件，轻松优化页面性能。
 - 对于异步资源加载，同时支持整站异步资源表配置和按页面异步资源表配置两种模式，可以根据项目情况灵活选择。对于大量使用异步依赖加载的项目可以使用整站异步资源表配置，充分利用缓存。对于大部分资源采用同步加载的项目，使用页面级的异步资源配置，最小化资源表，提高性能。

## 用法

    $ npm install -g fis-prepackager-autoload
    $ vi path/to/project/fis-conf.js

```javascript
//file : path/to/project/fis-conf.js
fis.config.set('modules.prepackager', 'autoload');
//添加combine插件，自动应用pack配置，打包零散资源
//fis.config.set('modules.prepackager', 'autoload, combine');
//设置useSiteMap切换整站/页面异步资源表配置
fis.config.set('settings.prepackager.autoload.useSiteMap', false);
```

**注意**

使用autoload插件的前提是使用前端模块化开发模式，点击查看[更多介绍](#)

## DEMO

[modjs-autoload-demo](https://github.com/hefangshi/modjs-autoload-demo)
