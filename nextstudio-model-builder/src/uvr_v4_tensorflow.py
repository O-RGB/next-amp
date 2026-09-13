import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

def conv2d_bn_activ(filters, kernel_size=3, strides=1, padding=1, dilation_rate=1, activation='relu', name=None):
    def apply(x):
        # PyTorch Conv2d(padding=N) always applies N samples to both sides.
        # TensorFlow's "same" padding is asymmetric for an even-sized input
        # combined with stride > 1, which shifts every encoder feature map by
        # one cell.  Use an explicit symmetric pad for strided convolutions so
        # the exported graph is numerically equivalent to the source model.
        if padding > 0 and strides > 1:
            x = layers.ZeroPadding2D(
                padding=((padding, padding), (padding, padding)),
                name=name + "_pad" if name else None,
            )(x)
            pad_mode = 'valid'
        else:
            pad_mode = 'same' if padding > 0 else 'valid'
        x = layers.Conv2D(
            filters=filters,
            kernel_size=kernel_size,
            strides=strides,
            padding=pad_mode,
            dilation_rate=dilation_rate,
            use_bias=True,
            name=name + "_conv" if name else None
        )(x)
        if activation == 'relu':
            x = layers.ReLU(name=name + "_relu" if name else None)(x)
        elif activation == 'leaky_relu':
            x = layers.LeakyReLU(alpha=0.01, name=name + "_leaky_relu" if name else None)(x)
        return x
    return apply

def seperable_conv2d_bn_activ(filters, kernel_size=3, strides=1, padding=1, dilation_rate=1, activation='relu', name=None):
    def apply(x):
        pad_mode = 'same' if padding > 0 else 'valid'
        x = layers.SeparableConv2D(
            filters=filters,
            kernel_size=kernel_size,
            strides=strides,
            padding=pad_mode,
            dilation_rate=dilation_rate,
            use_bias=True,  # BN folded into pointwise bias
            name=name + "_sepconv" if name else None
        )(x)
        if activation == 'relu':
            x = layers.ReLU(name=name + "_relu" if name else None)(x)
        elif activation == 'leaky_relu':
            x = layers.LeakyReLU(alpha=0.01, name=name + "_leaky_relu" if name else None)(x)
        return x
    return apply

def encoder(filters, kernel_size=3, strides=2, padding=1, activation='leaky_relu', name=None):
    def apply(x):
        skip = conv2d_bn_activ(filters, kernel_size, 1, padding, activation=activation, name=name + "_conv1")(x)
        h = conv2d_bn_activ(filters, kernel_size, strides, padding, activation=activation, name=name + "_conv2")(skip)
        return h, skip
    return apply

def decoder(filters, kernel_size=3, strides=1, padding=1, activation='relu', name=None):
    def apply(inputs):
        x, skip = inputs
        x = layers.Lambda(lambda t: tf.compat.v1.image.resize_bilinear(t, [tf.shape(t)[1]*2, tf.shape(t)[2]*2], align_corners=True))(x)
        if skip is not None:
            x = layers.Concatenate(axis=-1)([x, skip])
        x = conv2d_bn_activ(filters, kernel_size, 1, padding, activation=activation, name=name + "_conv")(x)
        return x
    return apply

def aspp_module(nin, nout, dilations=(4, 8, 16), activation='relu', name=None):
    def apply(x):
        # AdaptiveAvgPool2d((1, None)) from the PyTorch source is an average
        # pool over the complete frequency axis while preserving time. Using
        # AveragePooling2D keeps the exported AvgPool op understood by the
        # runtime ROI analyzer; ReduceMean is numerically valid but blocks that
        # established graph optimization.
        pool = layers.AveragePooling2D(
            pool_size=(int(x.shape[1]), 1),
            strides=(1, 1),
            padding="valid",
            name=name + "_avgpool" if name else None,
        )(x)
        pool = layers.Lambda(lambda t: tf.compat.v1.image.resize_bilinear(t[0], [tf.shape(t[1])[1], tf.shape(t[1])[2]], align_corners=True))([pool, x])
        feat1 = conv2d_bn_activ(nin, 1, 1, 0, activation=activation, name=name + "_conv1")(pool)

        feat2 = conv2d_bn_activ(nin, 1, 1, 0, activation=activation, name=name + "_conv2")(x)
        feat3 = seperable_conv2d_bn_activ(nin, 3, 1, dilations[0], dilations[0], activation=activation, name=name + "_conv3")(x)
        feat4 = seperable_conv2d_bn_activ(nin, 3, 1, dilations[1], dilations[1], activation=activation, name=name + "_conv4")(x)
        feat5 = seperable_conv2d_bn_activ(nin, 3, 1, dilations[2], dilations[2], activation=activation, name=name + "_conv5")(x)

        out = layers.Concatenate(axis=-1)([feat1, feat2, feat3, feat4, feat5])
        out = conv2d_bn_activ(nout, 1, 1, 0, activation=activation, name=name + "_bottleneck")(out)
        return out
    return apply

def base_aspp_net(ch, name="BaseASPPNet"):
    def apply(x):
        h, e1 = encoder(ch, 3, 2, 1, name=name + "_enc1")(x)
        h, e2 = encoder(ch * 2, 3, 2, 1, name=name + "_enc2")(h)
        h, e3 = encoder(ch * 4, 3, 2, 1, name=name + "_enc3")(h)
        h, e4 = encoder(ch * 8, 3, 2, 1, name=name + "_enc4")(h)

        h = aspp_module(ch * 8, ch * 16, (4, 8, 16), name=name + "_aspp")(h)

        h = decoder(ch * 8, 3, 1, 1, name=name + "_dec4")([h, e4])
        h = decoder(ch * 4, 3, 1, 1, name=name + "_dec3")([h, e3])
        h = decoder(ch * 2, 3, 1, 1, name=name + "_dec2")([h, e2])
        h = decoder(ch, 3, 1, 1, name=name + "_dec1")([h, e1])
        return h
    return apply

def create_cascaded_aspp_net(input_shape=(1024, 64, 2)):
    inputs = keras.Input(shape=input_shape, name="input")
    max_bin = input_shape[0]
    output_bin = input_shape[0] + 1

    x = inputs[:, :max_bin, :, :]
    bandw = max_bin // 2

    # model_capacity_data for 31191:
    # 0: (2, 16) -> stg1_low
    # 1: (2, 16) -> stg1_high
    # 2: (18, 8, 1, 1, 0) -> stg2_bridge (nin=18, nout=8)
    # 3: (8, 16) -> stg2_full
    # 4: (34, 16, 1, 1, 0) -> stg3_bridge (nin=34, nout=16)
    # 5: (16, 32) -> stg3_full
    # 6: (32, 2, 1) -> out (nin=32, nout=2)

    stg1_low = base_aspp_net(16, name="stg1_low_band_net")(x[:, :bandw, :, :])
    stg1_high = base_aspp_net(16, name="stg1_high_band_net")(x[:, bandw:, :, :])
    aux1 = layers.Concatenate(axis=1)([stg1_low, stg1_high])

    h = layers.Concatenate(axis=-1)([x, aux1])
    # stg2_bridge: nin=18 (2+16), nout=8, k=1, s=1, p=0
    h = conv2d_bn_activ(8, 1, 1, 0, name="stg2_bridge")(h)
    aux2 = base_aspp_net(16, name="stg2_full_band_net")(h)

    h = layers.Concatenate(axis=-1)([x, aux1, aux2])
    # stg3_bridge: nin=34 (2+16+16), nout=16, k=1, s=1, p=0
    h = conv2d_bn_activ(16, 1, 1, 0, name="stg3_bridge")(h)
    h = base_aspp_net(32, name="stg3_full_band_net")(h)

    # Keep logits as the exported output.  Both the browser and Go runtimes
    # apply sigmoid after selecting the active time window, avoiding a full
    # output-sized sigmoid while preserving the exact source-model mask.
    # Keep the source model's explicit SAME contract even though a 1x1,
    # stride-1 projection is numerically identical with VALID padding.  The
    # browser's conservative output-ROI optimizer only rewrites a projection
    # carrying that contract, so preserving it avoids silently losing the
    # existing low-latency output crop after conversion.
    out = layers.Conv2D(2, 1, padding="same", use_bias=False, name="out")(h)
    model = keras.Model(inputs=inputs, outputs=out, name="CascadedASPPNet")
    return model
