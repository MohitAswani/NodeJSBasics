const Product = require('../models/product');
const fileHelper = require('../util/file');

const { validationResult } = require('express-validator');
const { default: mongoose } = require('mongoose');

const ITEMS_PER_PAGE = require('../util/constants');

exports.getAddProduct = (req, res, next) => {
    res.render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        product: {},
        hasError: false,
        errorMessage: null,
        validationErrors: []
    });
};

exports.postAddProduct = (req, res, next) => {
    const { title, price, description } = req.body;
    const image = req.file;

    if (!image) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            editing: false,
            hasError: true,
            product: {
                title: title,
                price: price,
                description: description
            },
            errorMessage: 'Attached file is not an image.',
            validationErrors: []
        });
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            editing: false,
            hasError: true,
            product: {
                title: title,
                price: price,
                description: description
            },
            errorMessage: errors.array()[0].msg,
            validationErrors: errors.array()
        });
    }

    const imageUrl = image.path;

    const product = new Product({
        title: title,
        price: price,
        description: description,
        image: imageUrl,
        userId: req.user._id
    });

    product
        .save()
        .then(result => {
            console.log('CREATED PRODUCT');
            res.redirect('/admin/products');
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getEditProduct = (req, res, next) => {
    const editMode = req.query.edit;

    if (!editMode) {
        return res.redirect('/');
    }

    const prodId = req.params.productId;

    Product.findById(prodId)
        .then(product => {
            if (!product) {
                return res.redirect('/');
            }
            else {
                res.render('admin/edit-product', {
                    pageTitle: 'Edit Product',
                    path: '/admin/edit-product',
                    editing: true,
                    product: product,
                    hasError: false,
                    errorMessage: null,
                    validationErrors: [],
                });
            }
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.postEditProduct = (req, res, next) => {
    let id = req.body.id
    let { title, price, description } = req.body;
    id = id.trim();
    title = title.trim();
    price = parseFloat(price);
    description = description.trim();
    let image = req.file;

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Edit Product',
            path: '/admin/edit-product',
            editing: true,
            hasError: true,
            product: {
                _id: id,
                title: title,
                price: price,
                description: description
            },
            validationErrors: errors.array(),
            errorMessage: errors.array()[0].msg
        });
    }

    Product.findById(id)
        .then(product => {

            if (product.userId.toString() !== req.user._id.toString()) {
                return res.redirect('/');
            }
            product.title = title;
            product.price = price;
            product.description = description;
            if (image) {
                fileHelper.deleteFile(product.image);


                product.image = image.path;
            }
            return product.save()
                .then(result => {
                    console.log('UPDATED PRODUCT');
                    res.redirect('/admin/products');
                })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.getProducts = (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    let totalItems;

    Product.find({ userId: req.user._id }).countDocuments().then(numProducts => {
        totalItems = numProducts;
        return Product.find({ userId: req.user._id })
            .skip((page - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .populate('userId', 'name')
    })
        .then(products => {
            res.render('admin/products', {
                prods: products,
                pageTitle: 'Admin Products',
                path: '/admin/products',
                currentPage: page,
                hasNextPage: ITEMS_PER_PAGE * parseInt(page) < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });


};

exports.deleteProduct = (req, res, next) => {
    
    // Delete requests are not allowed to have a body so we extract the id using param.

    let  id  = req.params.productId;
    id = id.trim();


    Product.findById(id)
        .then(product => {
            if (!product) {
                return next(new Error('Product not found.'));
            }
            fileHelper.deleteFile(product.image);
            return Product.deleteOne({ _id: id, userId: req.user._id })
        })
        .then(() => {
            console.log("PRODUCT DELETED");

            // In the json function we can pass a normal JS object and it will be convert to normal JSON object.
            res.status(200).json({message:'Success!'});
        }) 
        .catch(err => {
            res.status(500).json({message:'Deleting product failed!'});
        });

};