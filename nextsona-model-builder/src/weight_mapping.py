import logging
import numpy as np
import tensorflow as tf

logger = logging.getLogger(__name__)

def fold_batch_norm(conv_w, bn_gamma, bn_beta, bn_mean, bn_var, eps=1e-5):
    scale = bn_gamma / np.sqrt(bn_var + eps)
    scale_reshaped = scale[:, None, None, None]
    w_folded = conv_w * scale_reshaped
    b_folded = bn_beta - bn_mean * scale
    return w_folded, b_folded

def apply_weight_mapping(keras_model, state_dict):
    used_keys = set()

    def get_pt_prefix(keras_name):
        import re
        name = keras_name
        if name.endswith("_conv"): name = name[:-5]
        elif name.endswith("_sepconv"): name = name[:-8]

        name = name.replace("_enc", ".enc")
        name = name.replace("_dec", ".dec")
        name = name.replace("_aspp", ".aspp")

        name = re.sub(r'\.enc(\d+)_conv(\d+)', r'.enc\1.conv\2', name)
        name = re.sub(r'\.dec(\d+)_conv', r'.dec\1.conv', name)
        name = re.sub(r'\.aspp_conv(\d+)', r'.aspp.conv\1', name)
        name = re.sub(r'\.aspp_bottleneck', r'.aspp.bottleneck.0', name)

        name = name.replace(".aspp.conv1", ".aspp.conv1.1")

        if ".enc" in name or ".dec" in name or ".aspp" in name or "bridge" in name:
            name += ".conv"

        return name

    for layer in keras_model.layers:
        if not layer.weights:
            continue

        name = layer.name
        if name in ["out", "aux1_out", "aux2_out"]:
            pt_prefix = name
            if f'{pt_prefix}.weight' in state_dict:
                w = state_dict[f'{pt_prefix}.weight'].numpy()
                w_keras = w.transpose(2, 3, 1, 0)
                layer.set_weights([w_keras])
                used_keys.add(f'{pt_prefix}.weight')
            continue

        pt_prefix = get_pt_prefix(name)

        if isinstance(layer, tf.keras.layers.SeparableConv2D):
            # PyTorch:
            # 0.weight (depthwise): (in, 1, 3, 3)
            # 1.weight (pointwise): (out, in, 1, 1)
            # 2.weight/bias/mean/var (BN)

            dw_w = state_dict[f'{pt_prefix}.0.weight'].numpy()
            pw_w = state_dict[f'{pt_prefix}.1.weight'].numpy()
            gamma = state_dict[f'{pt_prefix}.2.weight'].numpy()
            beta = state_dict[f'{pt_prefix}.2.bias'].numpy()
            mean = state_dict[f'{pt_prefix}.2.running_mean'].numpy()
            var = state_dict[f'{pt_prefix}.2.running_var'].numpy()

            used_keys.update([
                f'{pt_prefix}.0.weight', f'{pt_prefix}.1.weight',
                f'{pt_prefix}.2.weight', f'{pt_prefix}.2.bias',
                f'{pt_prefix}.2.running_mean', f'{pt_prefix}.2.running_var',
                f'{pt_prefix}.2.num_batches_tracked'
            ])

            w_folded, b_folded = fold_batch_norm(pw_w, gamma, beta, mean, var)

            # Keras dw: (H, W, in_c, depth_mult)
            dw_keras = dw_w.transpose(2, 3, 0, 1)
            # Keras pw: (1, 1, in_c, out_c)
            pw_keras = w_folded.transpose(2, 3, 1, 0)

            layer.set_weights([dw_keras, pw_keras, b_folded])

        elif isinstance(layer, tf.keras.layers.Conv2D):
            w_pt = state_dict[f'{pt_prefix}.0.weight'].numpy()
            gamma = state_dict[f'{pt_prefix}.1.weight'].numpy()
            beta = state_dict[f'{pt_prefix}.1.bias'].numpy()
            mean = state_dict[f'{pt_prefix}.1.running_mean'].numpy()
            var = state_dict[f'{pt_prefix}.1.running_var'].numpy()

            used_keys.update([
                f'{pt_prefix}.0.weight', f'{pt_prefix}.1.weight',
                f'{pt_prefix}.1.bias', f'{pt_prefix}.1.running_mean',
                f'{pt_prefix}.1.running_var', f'{pt_prefix}.1.num_batches_tracked'
            ])

            w_folded, b_folded = fold_batch_norm(w_pt, gamma, beta, mean, var)
            w_keras = w_folded.transpose(2, 3, 1, 0)
            layer.set_weights([w_keras, b_folded])

    all_keys = set(state_dict.keys())
    unused = all_keys - used_keys
    if unused:
        logger.warning(f"Unused keys: {len(unused)}")
    return unused
