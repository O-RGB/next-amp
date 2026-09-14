def crop_center(h1, h2):
    h1_shape = h1.size()
    h2_shape = h2.size()
    if h1_shape[3] == h2_shape[3]: return h1
    s_time = (h1_shape[3] - h2_shape[3]) // 2
    e_time = s_time + h2_shape[3]
    return h1[:, :, :, s_time:e_time]
