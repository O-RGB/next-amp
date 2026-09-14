import torch
from torch import nn
from uvr_nets import CascadedASPPNet, determine_model_capacity

class PyTorchModelWrapper(nn.Module):
    def __init__(self, model, output_logits=False):
        super().__init__()
        self.model = model
        self.output_logits = output_logits

    def forward(self, x):
        # Input x is NHWC (1, 1024, 64, 2)
        x = x.permute(0, 3, 1, 2)  # Convert to NCHW -> (1, 2, 1024, 64)
        output = self.model.forward_logits(x) if self.output_logits else self.model(x)
        # The logits head is already 1024 bins. The regular source model pads
        # its mask to 1025 bins, so only that path needs truncation.
        if not self.output_logits:
            output = output[:, :, :1024, :]
        output = output.permute(0, 2, 3, 1) # Back to NHWC -> (1, 1024, 64, 2)
        return output

def get_model(checkpoint_path, map_location='cpu', output_logits=False):
    # In MGM_MAIN_v4, nn_architecture is 31191
    nn_architecture = 31191
    model_capacity_data = determine_model_capacity(2048, nn_architecture)
    model = CascadedASPPNet(2048, model_capacity_data, nn_architecture)

    state_dict = torch.load(checkpoint_path, map_location=map_location)
    model.load_state_dict(state_dict)
    model.eval()

    wrapper = PyTorchModelWrapper(model, output_logits=output_logits)
    wrapper.eval()
    return wrapper
