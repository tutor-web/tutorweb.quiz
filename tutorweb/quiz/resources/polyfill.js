// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/keys
Object.keys||(Object.keys=function(a){if(a!==Object(a))throw new TypeError("Object.keys called on non-object");var c=[],b;for(b in a)Object.prototype.hasOwnProperty.call(a,b)&&c.push(b);return c});

// Reference: http://es5.github.com/#x15.4.4.19
Array.prototype.map||(Array.prototype.map=function(d,f){var g,e,a;if(null==this)throw new TypeError(" this is null or not defined");var b=Object(this),h=b.length>>>0;if("function"!==typeof d)throw new TypeError(d+" is not a function");f&&(g=f);e=Array(h);for(a=0;a<h;){var c;a in b&&(c=b[a],c=d.call(g,c,a,b),e[a]=c);a++}return e});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
Array.prototype.filter||(Array.prototype.filter=function(c){if(void 0===this||null===this)throw new TypeError;var b=Object(this),f=b.length>>>0;if("function"!=typeof c)throw new TypeError;for(var d=[],g=2<=arguments.length?arguments[1]:void 0,a=0;a<f;a++)if(a in b){var e=b[a];c.call(g,e,a,b)&&d.push(e)}return d});

// https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
Array.prototype.reduce||(Array.prototype.reduce=function(d){if(null==this)throw new TypeError("Array.prototype.reduce called on null or undefined");if("function"!==typeof d)throw new TypeError(d+" is not a function");var b=Object(this),e=b.length>>>0,a=0,c;if(2==arguments.length)c=arguments[1];else{for(;a<e&&!a in b;)a++;if(a>=e)throw new TypeError("Reduce of empty array with no initial value");c=b[a++]}for(;a<e;a++)a in b&&(c=d(c,b[a],a,b));return c});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
Array.prototype.indexOf||(Array.prototype.indexOf=function(d){if(null==this)throw new TypeError;var c=Object(this),b=c.length>>>0;if(0===b)return-1;var a=0;1<arguments.length&&(a=Number(arguments[1]),a!=a?a=0:0!=a&&(Infinity!=a&&-Infinity!=a)&&(a=(0<a||-1)*Math.floor(Math.abs(a))));if(a>=b)return-1;for(a=0<=a?a:Math.max(b-Math.abs(a),0);a<b;a++)if(a in c&&c[a]===d)return a;return-1});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
String.prototype.a||Object.defineProperty(String.prototype,"endsWith",{enumerable:!1,configurable:!1,writable:!1,value:function(b,a){a=a||this.length;a-=b.length;var c=this.lastIndexOf(b);return-1!==c&&c===a}});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
Function.prototype.bind||(Function.prototype.bind=function(b){function c(){return d.apply(this instanceof a&&b?this:b,e.concat(Array.prototype.slice.call(arguments)))}function a(){}if("function"!==typeof this)throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");var e=Array.prototype.slice.call(arguments,1),d=this;a.prototype=this.prototype;c.prototype=new a;return c});

// https://raw.githubusercontent.com/davidchambers/Base64.js/master/base64.min.js
!function(){function t(t){this.message=t}var r="undefined"!=typeof exports?exports:this,e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";t.prototype=new Error,t.prototype.name="InvalidCharacterError",r.btoa||(r.btoa=function(r){for(var o,n,a=String(r),i=0,c=e,d="";a.charAt(0|i)||(c="=",i%1);d+=c.charAt(63&o>>8-i%1*8)){if(n=a.charCodeAt(i+=.75),n>255)throw new t("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");o=o<<8|n}return d}),r.atob||(r.atob=function(r){var o=String(r).replace(/=+$/,"");if(o.length%4==1)throw new t("'atob' failed: The string to be decoded is not correctly encoded.");for(var n,a,i=0,c=0,d="";a=o.charAt(c++);~a&&(n=i%4?64*n+a:a,i++%4)?d+=String.fromCharCode(255&n>>(-2*i&6)):0)a=e.indexOf(a);return d})}();

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 */
var split;
split=split||function(k){var n=String.prototype.split,l=/()??/.exec("")[1]===k,f;f=function(c,a,e){if("[object RegExp]"!==Object.prototype.toString.call(a))return n.call(c,a,e);var d=[],g=(a.ignoreCase?"i":"")+(a.multiline?"m":"")+(a.extended?"x":"")+(a.sticky?"y":""),h=0;a=new RegExp(a.source,g+"g");var f,b,m;c+="";l||(f=new RegExp("^"+a.source+"$(?!\\s)",g));for(e=e===k?4294967295:e>>>0;b=a.exec(c);){g=b.index+b[0].length;if(g>h&&(d.push(c.slice(h,b.index)),!l&&1<b.length&&b[0].replace(f,function(){for(var a=1;a<arguments.length-2;a++)arguments[a]===k&&(b[a]=k)}),1<b.length&&b.index<c.length&&Array.prototype.push.apply(d,b.slice(1)),m=b[0].length,h=g,d.length>=e))break;a.lastIndex===b.index&&a.lastIndex++}h===c.length?!m&&a.test("")||d.push(""):d.push(c.slice(h));return d.length>e?d.slice(0,e):d};String.prototype.split=function(c,a){return f(this,c,a)};return f}();
