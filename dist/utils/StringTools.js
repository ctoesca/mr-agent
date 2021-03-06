String.prototype.rightOf = function (search) {
    let index = this.indexOf(search);
    if (index > -1) {
        return this.substring(index + search.length, this.length);
    }
    else {
        return '';
    }
};
String.prototype.rightRightOf = function (souschaine) {
    let index = this.lastIndexOf(souschaine);
    if (index > -1) {
        return this.substr(index + souschaine.length);
    }
    else {
        return '';
    }
};
String.prototype.stripAccents = function () {
    let translate_re = /[àáâãäçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ]/g;
    let translate = 'aaaaaceeeeiiiinooooouuuuyyAAAAACEEEEIIIINOOOOOUUUUY';
    return (this.replace(translate_re, function (match) {
        return translate.substr(translate_re.source.indexOf(match) - 1, 1);
    }));
};
String.prototype.contains = function (it) {
    return this.indexOf(it) > -1;
};
String.prototype.leftOf = function (souschaine) {
    let index = this.indexOf(souschaine, 0);
    if (index >= 0) {
        return this.substring(0, index);
    }
    else {
        return '';
    }
};
String.prototype.removeEnd = function (s, caseInsensistive = false) {
    if (this.endsWith(s, caseInsensistive)) {
        return this.substring(0, this.length - s.length);
    }
    else {
        return this.toString();
    }
};
String.prototype.hashCode = function () {
    var hash = 0, i, chr;
    if (this.length === 0)
        return hash;
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash;
};
//# sourceMappingURL=StringTools.js.map