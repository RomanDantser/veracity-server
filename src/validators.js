function validateInputName(inputName) {
    if(typeof inputName !== 'string' || inputName.length > 30 || inputName.length < 4) {
        return false;
    }

    const regExRuLetters = /^[А-я]+$/;

    if(!regExRuLetters.test(inputName)) {
        return false;
    }

    return true;
}

function validateLDAP(LDAP) {
    if(typeof LDAP !== 'string' || LDAP.length !== 8 || LDAP[0] !== '6') {
        return false;
    }

    const regExOnlyNumbers = /^[0-9]+$/;

    if (!regExOnlyNumbers.test(LDAP)) {
        return false;
    }

    return true;
}

function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 6 || password.length > 50) {
        return false;
    }
    return true;
}

function validateSubdivision(subdivision) {
    if(typeof subdivision !== 'string' || (subdivision !== 'Коммерция' && subdivision !== 'Логистика')) {
        return false;
    }
    return true;
}

function validateDepartment(department) {
    if(typeof department !== 'number' || department < 0 || department > 15) {
        return false;
    }
    return true;
}

function validateUserOnRegister(firstName, lastName, LDAP, department, subdivision, password) {
    if (!validateInputName(firstName) || !validateInputName(lastName)) {
        return ({ error: 'Введите корректные имя и фамилию' });
     }
 
     if(!validateLDAP(LDAP)) {
        return ({ error: 'Введите корректный LDAP' });
     }
 
     if(!validateDepartment(department)) {
        return ({ error: 'Некорректный отдел' });
     }
 
     if(!validateSubdivision(subdivision)) {
        return ({ error: 'Некорректный ввод сферы работы' });
     }
 
     if(!validatePassword(password)) {
        return ({ error: 'Пароль не подходит по критериям' });
    }

    return ({ message: 'OK' })
}


function validateProgramQuantity(num) {
    return (typeof num === 'number' && num > -100000 && num < 100000);
}

function validateFactQuantity(num) {
    return (typeof num === 'number' && num > 0 && num < 100000);
}

function validateComments(comment) {
    return (typeof comment === 'string' && comment.length < 300);
}

function validateItemOnUpload(programQuantity, factQuantity, comment) {
    
    if(!validateProgramQuantity(programQuantity)) {
        return ({ error: 'Некорректный ввод товара \"в программе\"' });
    }

    if(!validateFactQuantity(factQuantity)) {
        return ({ error: 'Некорректный ввод товара по факту' });
    }

    if(comment && !validateComments(comment)) {
        return ({ error: 'Некорректный комментарий' })
    }   

    if(programQuantity === factQuantity) {
        return ({ error: "Если есть аномалия, то товар по факту не может быть равен товару в программе" })
    }

    return ({ message: 'OK' })
}

module.exports = {
    validateUserOnRegister,
    validateItemOnUpload
}