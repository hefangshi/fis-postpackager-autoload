# fis-postpackager-autoload

用于自动加载模块化资源的[FIS](https://github.com/fex-team/fis)插件

## 功能

 - 将当前页面的所有资源依赖自动注入页面中，


## 功能特点

 - 无需手工维护 ```<script src="path"></script>``` 或 ```<link rel="stylesheet" href="path">``` 标签引用资源，页面依赖的资源会自动加载，实现**像写Node.js程序一样编写前端页面**。
 - 与[fis-postprocessor-require-async](https://github.com/xiangshouding/fis-postprocessor-require-async)插件结合，支持[modjs](https://github.com/fex-team/mod)的require.async异步加载功能
 - 使[modjs](https://github.com/fex-team/mod)脱离后端静态资源管理依赖，使用成本更低，配合[fis-postpackager-simple](https://github.com/hefangshi/fis-postpackager-simple)插件，轻松优化页面性能。
 - 支持[amd](https://github.com/fex-team/fis-postprocessor-amd)脱离后端静态资源管理，轻松加载AMD资源。

## 自定义输出

插件默认会将引用的资源添加至head标签结尾，如果需要定制位置，可以通过在页面中注入占位符来满足需求

```html
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <!--STYLE_PLACEHOLDER-->
</head>
<body>
    <div class="main"></div>
    <!--SCRIPT_PLACEHOLDER-->
    <!--RESOURCEMAP_PLACEHOLDER-->
    <script type="text/javascript">
        require('main');
    </script>
</body>
</html>
```

目前支持三种占位符

* `<!--SCRIPT_PLACEHOLDER-->` 用于指定脚本输出位置
* `<!--RESOURCEMAP_PLACEHOLDER-->` 用于指定异步脚本资源表输出位置，需要在mod.js引用后，异步请求前输出
* `<!--STYLE_PLACEHOLDER-->` 用于指定样式输出位置

## 用法

    $ npm install -g fis-postpackager-autoload
    $ vi path/to/project/fis-conf.js

```javascript
//file : path/to/project/fis-conf.js
fis.config.set('modules.postpackager', 'autoload');

//添加combine插件，自动应用pack配置，打包零散资源
//fis.config.set('modules.postpackager', 'autoload, simple');

//useSiteMap设置使用整站/页面异步资源表配置，默认为false
fis.config.set('settings.postpackager.autoload.useSiteMap', true);

//useInlineMap设置内联resourceMap还是异步加载resourceMap，默认为false
fis.config.set('settings.postpackager.autoload.useInlineMap', true);

//通过include属性将额外的资源增加入resourceMap中
fis.config.set('settings.postpackager.autoload.include', /^\/somepath\//i);

//设置占位符
fis.config.set('settings.postpackager.autoload.scriptTag', '<!--SCRIPT_PLACEHOLDER-->');
fis.config.set('settings.postpackager.autoload.styleTag', '<!--STYLE_PLACEHOLDER-->');
fis.config.set('settings.postpackager.autoload.resourceMapTag', '<!--RESOURCEMAP_PLACEHOLDER-->');

//开启AMD模式
fis.config.set('settings.postpackager.autoload.type', 'requirejs');
```

## DEMO

[modjs-autoload-demo](https://github.com/hefangshi/modjs-autoload-demo)
